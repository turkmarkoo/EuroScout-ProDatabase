"""Refresh the private D1 projection using native hydration and bounded delta imports."""
import argparse,json,os,shutil,sqlite3,subprocess,hashlib
from datetime import datetime,timezone
from pathlib import Path
from contextlib import closing
from collections import Counter,defaultdict
from prepare import prepare
from delta import export

def stable_person_ids(source,baseline):
    """Choose a retained stats ID within native-verified groups, never by matching names."""
    if not Path(baseline).exists():return {}
    profiles={p['id']:p for l in source.get('leagues',[]) for p in l.get('players',[])}
    groups=defaultdict(Counter)
    with closing(sqlite3.connect(baseline)) as con:
        for payload, in con.execute('SELECT payload FROM stats_rows'):
            old=json.loads(payload);p=profiles.get(old['profileId'])
            if not p or old.get('born') and p.get('born') and old['born']!=p['born']:continue
            canonical=p.get('_canonicalPersonId') or p.get('linkedEuroScoutId') or p['id']
            groups[old['season']+'|'+old['competition']+'|'+str(canonical)][old['personId']]+=1
    return {group:sorted(counts,key=lambda id:(-counts[id],id))[0] for group,counts in groups.items()}

def estimate_writes(baseline,candidate,delta):
    with closing(sqlite3.connect(baseline)) as old,closing(sqlite3.connect(candidate)) as new:
        before={id:json.loads(p) for id,p in old.execute('SELECT id,payload FROM stats_rows')};after={id:json.loads(p) for id,p in new.execute('SELECT id,payload FROM stats_rows')}
        changed=[id for id,r in after.items() if id not in before or {k:v for k,v in r.items() if k!='updated'}!={k:v for k,v in before[id].items() if k!='updated'}]
        return sum(3+2*len(after[id]['countries'])+2*len(before.get(id,{}).get('countries',[])) for id in changed)+delta.read_text(encoding='utf-8').count('UPDATE stats_meta')+5

def defer_historical_additions(baseline,candidate,target,current_season):
    """Retain every published row and all current-season additions; explicitly queue new history."""
    with closing(sqlite3.connect(baseline)) as old,closing(sqlite3.connect(candidate)) as new:
        known={r[0] for r in old.execute('SELECT id FROM stats_rows')}
        rows=[json.loads(r[0]) for r in new.execute('SELECT payload FROM stats_rows')]
        current_start=int(current_season[:4])
        pending=[r for r in rows if r['id'] not in known and int(r['season'][:4])<current_start]
        if not pending:return None
        shutil.copy2(candidate,target)
        with closing(sqlite3.connect(target)) as staged:
            staged.executemany('DELETE FROM stats_nationalities WHERE row_id=?',[(r['id'],) for r in pending])
            staged.executemany('DELETE FROM stats_rows WHERE id=?',[(r['id'],) for r in pending])
            meta=json.loads(staged.execute("SELECT value FROM stats_meta WHERE key='catalogue'").fetchone()[0])
            remaining=[json.loads(r[0]) for r in staged.execute('SELECT payload FROM stats_rows')]
            scopes={(r['season'],r['competition'],r['teamId']) for r in remaining}
            meta['teams']=[t for t in meta['teams'] if (t['season'],t['competition'],t['id']) in scopes]
            meta['records']=len(remaining)
            meta['coverage']={'historicalPending':len(pending),'message':str(len(pending))+' additional historical records are queued for the next refresh with sufficient free allowance. Current-season records are included.'}
            meta['version']=hashlib.sha256(json.dumps(remaining,sort_keys=True).encode()).hexdigest()[:24]
            staged.execute("UPDATE stats_meta SET value=? WHERE key='catalogue'",(json.dumps(meta,ensure_ascii=False),));staged.commit()
            return meta

def run(args,timeout=240):
    p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=timeout,creationflags=0x08000000 if os.name=='nt' else 0)
    if p.returncode:raise RuntimeError('Statistics refresh command failed: '+(p.stderr or p.stdout)[-1200:])
    return p.stdout

def wrangler_result(output):
    # Wrangler's file-import command can prepend progress lines even with --json.
    # Accept only its successful result array, never a stray bracket in a warning.
    decoder=json.JSONDecoder()
    for start,char in enumerate(output):
        if char!='[':continue
        try:value,_=decoder.raw_decode(output[start:])
        except json.JSONDecodeError:continue
        if isinstance(value,list) and value and all(isinstance(r,dict) and r.get('success') is True and isinstance(r.get('meta'),dict) for r in value):return value
    raise ValueError('The deployment tool returned no verified JSON result; reconcile the hosted version before retrying')

def sync(config,dry_run=False):
    cfg=json.loads(Path(config).read_text(encoding='utf-8'));directory=Path(cfg['stateDir']);directory.mkdir(parents=True,exist_ok=True)
    app=Path(cfg['appRoot']);service=app/'stats-service';private=Path(cfg['privateDir']);ledger_path=directory/'write-ledger.json'
    fingerprint=hashlib.sha256(b''.join((private/f).read_bytes() for f in ['euroscout-feed.json','scout-board-feed.json'])+(service/'catalogue.py').read_bytes()+(service/'project.cjs').read_bytes()).hexdigest()
    marker=directory/'last-success.json'
    if not dry_run and marker.exists() and json.loads(marker.read_text())['fingerprint']==fingerprint:return {'status':'unchanged'}
    lock=directory/'refresh.lock'
    try:fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError:return {'status':'already_running'}
    os.close(fd)
    try:
        run([cfg.get('node','node'),str(service/'project.cjs'),str(Path(config).resolve())],timeout=300)
        source=json.loads(Path(cfg['projection']).read_text(encoding='utf-8'));countries=json.loads(Path(cfg['countries']).read_text(encoding='utf-8'))
        baseline=directory/'published.sqlite'
        source['canonicalStatsIds']=stable_person_ids(source,baseline)
        candidate=directory/'candidate.sqlite';built=prepare([source],countries,candidate)
        delta=directory/'delta.sql'
        changes=export(baseline,candidate,delta) # unexpected removals stop, retaining published data
        estimate=estimate_writes(baseline,candidate,delta)
        date=datetime.now(timezone.utc).date().isoformat();ledger=json.loads(ledger_path.read_text()) if ledger_path.exists() else {'date':date,'writes':0}
        if ledger['date']!=date:ledger={'date':date,'writes':0}
        result={'status':'validated' if dry_run else 'updated','records':built['records'],'changes':changes['addedOrChanged'],'estimatedWrites':estimate,'previousDailyWrites':ledger['writes'],'version':built['version']}
        if dry_run:return result
        if ledger['writes']+estimate>cfg.get('dailyWriteLimit',100000):
            staged=directory/'current-priority.sqlite'
            limited=defer_historical_additions(baseline,candidate,staged,cfg.get('currentSeason','2026/27'))
            if not limited:return {**result,'status':'deferred_free_limit'}
            changes=export(baseline,staged,delta);estimate=estimate_writes(baseline,staged,delta)
            if ledger['writes']+estimate>cfg.get('dailyWriteLimit',100000):return {**result,'status':'deferred_free_limit'}
            candidate=staged;built=limited
            result.update(status='updated_history_pending',records=built['records'],changes=changes['addedOrChanged'],estimatedWrites=estimate,version=built['version'],historicalPending=built['coverage']['historicalPending'])
        command=[cfg.get('powershell','pwsh'),'-NoProfile','-File',cfg['wranglerHelper'],'d1','execute',cfg['databaseName'],'--remote','--config',cfg['wranglerConfig'],'--yes','--json']
        # Check the remote baseline before changing it; never overwrite another publisher.
        remote=wrangler_result(run(command+['--command',"SELECT json_extract(value,'$.version') version FROM stats_meta WHERE key='catalogue';"]))
        with closing(sqlite3.connect(baseline)) as previous:expected=json.loads(previous.execute("SELECT value FROM stats_meta WHERE key='catalogue'").fetchone()[0])['version']
        remote_version=remote[0]['results'][0]['version']
        if remote_version not in (expected,built['version']):raise RuntimeError('Hosted version differs from the published baseline; reconcile before refreshing')
        writes=0
        if remote_version!=built['version']:
            # Reserve conservatively before transmission. An interrupted import cannot cause a second attempt to exceed the free allowance.
            ledger['writes']+=estimate;ledger_path.write_text(json.dumps(ledger),encoding='utf-8')
            output=wrangler_result(run(command+['--file',str(delta)],timeout=300));writes=sum(r.get('meta',{}).get('rows_written',0) for r in output)
            ledger['writes']+=writes-estimate;ledger_path.write_text(json.dumps(ledger),encoding='utf-8')
        verified=wrangler_result(run(command+['--command',"SELECT json_extract(value,'$.version') version FROM stats_meta WHERE key='catalogue'; SELECT count(*) records FROM stats_rows;"]))
        if verified[0]['results'][0]['version']!=built['version'] or verified[1]['results'][0]['records']!=built['records']:raise RuntimeError('Hosted statistics verification failed; published baseline retained')
        tmp=baseline.with_suffix('.tmp');shutil.copy2(candidate,tmp);os.replace(tmp,baseline)
        if not built.get('coverage',{}).get('historicalPending'):marker.write_text(json.dumps({'fingerprint':fingerprint,'version':built['version'],'at':datetime.now(timezone.utc).isoformat()}),encoding='utf-8')
        if cfg.get('identitySnapshot'):shutil.copy2(cfg['projection'],cfg['identitySnapshot'])
        return {**result,'actualWrites':writes}
    finally:lock.unlink(missing_ok=True)

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--settings',required=True);a.add_argument('--dry-run',action='store_true');args=a.parse_args()
    try:print(json.dumps(sync(args.settings,args.dry_run)))
    except Exception as e:print(json.dumps({'status':'retained_previous','error':str(e)}));raise SystemExit(1)
