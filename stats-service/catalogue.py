"""Compact, season-explicit statistics projection. Contains no scouting notes."""
import hashlib,json,re,sqlite3,unicodedata,math
from pathlib import Path

ALIASES={'fra':'lnb','fra2':'elite2','aus':'nbl','cro':'hrv','aut':'autbsl','ita2':'seriea2','gbr':'britain','kos':'kosovo','isl':'iceland','svk':'slovakia','mne':'montenegro','bih':'bosnia','den':'denmark','sui':'swiss','seriea':'lba','pol':'plk','greece':'gbl','isr':'il','slovenia':'slo','bcl26':'bcl','fec26':'fec'}
METRICS='g mpg ppg rpg apg spg bpg topg drpg fgp f2p f3p ftp ts efg pir eff usg pts40 reb40 ast40 stl40 blk40 tov40 astto ftr r3a pps astp tovp trbp stlp blkp t_min t_pts t_reb t_ast t_stl t_blk t_tov t_fgm t_fga t_f3m t_f3a t_ftm t_fta t_pir'.split()
TOTALS={'t_min':'min','t_pts':'pts','t_reb':'reb','t_ast':'ast','t_stl':'stl','t_blk':'blk','t_tov':'tov','t_fgm':'fgm','t_fga':'fga','t_f3m':'p3m','t_f3a':'p3a','t_ftm':'ftm','t_fta':'fta','t_pir':'pir'}
def fold(value):
    value=str(value or '').replace('đ','dj').replace('Đ','dj').replace('ł','l').replace('Ł','l')
    return ''.join(c.lower() for c in unicodedata.normalize('NFD',value) if not unicodedata.combining(c) and c.isalnum())
def season(value):
    if re.fullmatch(r'20\d{2}',str(value or '')):return str(value)
    m=re.search(r'(20\d{2})\D+(?:20)?(\d{2})',str(value or ''))
    if m and int(m[2])==int(m[1][-2:])+1:return m[1]+'/'+m[2]
    return None
def competition(meta):
    raw=meta.get('dragonsCompetition','').lower() or meta['id']
    raw={'ec':'eurocup','el':'euroleague','otp':'slo','swe':'sbl','gre':'gbl','ita':'lba','ncaa':'ncaam','glg':'gleague','bblq':'bclq'}.get(raw,raw)
    return ALIASES.get(raw,raw)
def numeric(v):
    return float(v) if isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) else None
def nationalities(value,registry):
    values=value if isinstance(value,list) else re.split(r'\s*[/;|]\s*',str(value or ''))
    out=[]
    for v in values:
        code=registry.get(fold(v))
        if code and code not in out:out.append(code)
    return out
def create(con):
    con.executescript('''CREATE TABLE IF NOT EXISTS stats_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stats_rows(id TEXT PRIMARY KEY,person_id TEXT NOT NULL,profile_id TEXT NOT NULL,season TEXT NOT NULL,competition TEXT NOT NULL,team_id TEXT NOT NULL,name TEXT NOT NULL,search_name TEXT NOT NULL,role TEXT,qualified INTEGER NOT NULL,payload TEXT NOT NULL,'''+','.join(k+' REAL' for k in METRICS)+''');
    CREATE TABLE IF NOT EXISTS stats_nationalities(row_id TEXT NOT NULL,country TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS stats_country ON stats_nationalities(row_id,country);
    CREATE INDEX IF NOT EXISTS stats_scope ON stats_rows(season,competition,team_id,role,qualified);
    ''')
def build(con,sources,countries):
    """Sources in increasing evidence priority; each row stays within one competition/season."""
    registry={fold(alias):c['id'] for c in countries for alias in [c['id'],c['name'],*c.get('aliases',[])]}
    result={};unresolved=[];competitions={};teams={};rules={};dates=[]
    bios={};by_identity={};team_logos={};canonical_logos={}
    for source in sources:
        for league in source.get('leagues',[]):
            for t in league.get('teams',[]):
                if t.get('logo'):
                    team_logos.setdefault(fold(t['name']),set()).add(t['logo'])
                    canonical_logos[t.get('key') or league['meta']['id']+'|'+str(t.get('code'))]=t['logo']
            for p in league.get('players',[]):
                bios[p['id']]=p
                if p.get('born'):by_identity.setdefault((fold(p['name']),int(p['born'])),[]).append((competition(league['meta']),p))
    for source in sources:
        if source.get('generated'):dates.append(source['generated'])
        for league in source.get('leagues',[]):
            meta=league['meta'];year=season(meta.get('statsSeason') or meta.get('season'))
            if not year or meta.get('teamsOnly') or meta.get('exhibition'):continue
            comp=competition(meta);competitions[comp]={'id':comp,'name':meta['name'],'logo':meta.get('logo')}
            rules[year+'|'+comp]={'games':meta.get('minGames',0),'minutes':meta.get('minMpg',0)}
            teammap={str(t['code']):t for t in league.get('teams',[])}
            for original in league.get('players',[]):
                p=dict(original)
                # Identity resolution belongs to the existing verified roster/link pipeline.
                # The statistics projection must never merge people by a matching name.
                prior=bios.get(p.get('linkedEuroScoutId') or p.get('_canonicalPersonId'))
                if prior:
                    for k in ['img','born','height','country','role','pos']:
                        if not p.get(k) or p.get(k)=='Unknown':p[k]=prior.get(k)
                py=season(p.get('statsSeason') or p.get('_sourceSeason')) or year
                if numeric(p.get('g')) is None or p['g']<=0 or p.get('_rosterOnly'):continue
                team=dict(teammap.get(str(p.get('team')),{}))
                logos=team_logos.get(fold(p.get('teamName') or team.get('name')),set())
                if not team.get('logo') and len(logos)==1:team['logo']=next(iter(logos))
                team_id=p.get('_sourceTeamKey') or team.get('key') or comp+'|'+str(p.get('team') or '')
                if not team.get('logo'):team['logo']=canonical_logos.get(team_id)
                teams[py+'|'+comp+'|'+team_id]={'id':team_id,'name':p.get('teamName') or team.get('name') or 'Unknown team','competition':comp,'season':py,'logo':team.get('logo')}
                # Source IDs and established links only; no automatic same-name merging.
                # The native canonical ID already resolves a link's merged aliases.
                # A provider's direct link can point to an older member of that group.
                canonical=p.get('_canonicalPersonId') or p.get('linkedEuroScoutId') or p['id']
                person=source.get('canonicalStatsIds',{}).get(py+'|'+comp+'|'+str(canonical),canonical)
                key=py+'|'+comp+'|'+str(person)
                metrics={k:numeric(p.get(k)) for k in METRICS}
                for field,src in TOTALS.items():
                    exact=numeric(p.get('dragonsTotals',{}).get(src))
                    if exact is None:exact=numeric(p.get('_exactLogTotals',{}).get(src))
                    if exact is not None:metrics[field]=exact
                    elif p.get('_logCount') is not None:metrics[field]=None
                if metrics['t_min'] is None:metrics['t_min']=numeric(p.get('min'))
                coverage=p.get('statisticsCoverage') or {}
                minute_games=coverage.get('metricGames',{}).get('mpg') or p['g']
                if metrics['t_min'] is not None and metrics['mpg'] is not None and abs(metrics['t_min']/minute_games-metrics['mpg'])>.11:metrics['t_min']=None
                # Exact shot counts are safe; rounded per-game averages are never multiplied into totals.
                for stem,field in [('fg','t_fg'),('f3','t_f3'),('ft','t_ft')]:
                    match=re.fullmatch(r'(\d+)\s*[-/]\s*(\d+)',str(p.get(stem+'ma') or ''))
                    if match:
                        for suffix,val in zip(['m','a'],match.groups()):
                            if metrics[field+suffix] is None:metrics[field+suffix]=float(val)
                if metrics['astto'] is None and metrics['apg'] is not None and metrics['topg']:metrics['astto']=metrics['apg']/metrics['topg']
                fga=metrics['t_fga'];fgm=metrics['t_fgm'];threes=metrics['t_f3m'];fta=metrics['t_fta'];pts=metrics['t_pts']
                if metrics['efg'] is None and fga and fgm is not None and threes is not None:metrics['efg']=100*(fgm+.5*threes)/fga
                if metrics['ts'] is None and fga is not None and fta is not None and pts is not None and fga+.44*fta>0:metrics['ts']=100*pts/(2*(fga+.44*fta))
                if fga:
                    if metrics['ftr'] is None and fta is not None:metrics['ftr']=fta/fga
                    if metrics['r3a'] is None and metrics['t_f3a'] is not None:metrics['r3a']=metrics['t_f3a']/fga
                    if metrics['pps'] is None and pts is not None:metrics['pps']=pts/fga
                for target,total in [('pts40','t_pts'),('reb40','t_reb'),('ast40','t_ast'),('stl40','t_stl'),('blk40','t_blk'),('tov40','t_tov')]:
                    if metrics[target] is None and metrics['t_min'] and metrics[total] is not None:metrics[target]=40*metrics[total]/metrics['t_min']
                if coverage.get('partial'):
                    # Separate source samples cannot be combined into advanced rates.
                    for field in ['astto','ts','efg','ftr','r3a','pps','pts40','reb40','ast40','stl40','blk40','tov40']:metrics[field]=None
                role={'Center':'Big','Point Guard':'Guard','Shooting Guard':'Guard','Small Forward':'Forward','Power Forward':'Forward','Wing':'Forward'}.get(p.get('role'),p.get('role'))
                photo=p.get('img');photo=photo if photo and (photo.startswith(('https://','http://','assets/'))) else None
                row={'id':hashlib.sha256(key.encode()).hexdigest()[:32],'personId':str(person),'profileId':p['id'],'sourceLeagueId':meta['id'],'teamCode':p.get('team'),'season':py,'competition':comp,'teamId':team_id,'name':p['name'],'height':p.get('height'),'born':p.get('born'),'photo':photo,'role':role if role in ['Guard','Forward','Big'] else None,'countries':nationalities(p.get('nationalities') or p.get('country'),registry),'team':teams[py+'|'+comp+'|'+team_id]['name'],'teamLogo':team.get('logo'),'competitionName':meta['name'],'metrics':metrics,'pct':p.get('pct',{}),'source':meta.get('source'),'updated':source.get('generated')}
                row['qualified']=bool(p.get('qualified')) and p['g']>=float(meta.get('minGames') or 0) and (not meta.get('minMpg') or metrics['mpg'] is not None and metrics['mpg']>=meta['minMpg'])
                if coverage:row['coverage']=coverage
                result[key]=row
    create(con)
    con.execute('DELETE FROM stats_nationalities');con.execute('DELETE FROM stats_rows')
    fields=['id','person_id','profile_id','season','competition','team_id','name','search_name','role','qualified','payload',*METRICS]
    for row in result.values():
        vals=[row['id'],row['personId'],row['profileId'],row['season'],row['competition'],row['teamId'],row['name'],fold(row['name']),row['role'],int(row['qualified']),json.dumps(row,ensure_ascii=False),*[row['metrics'][k] for k in METRICS]]
        con.execute('INSERT INTO stats_rows('+','.join(fields)+') VALUES('+','.join('?' for _ in fields)+')',vals)
        con.executemany('INSERT INTO stats_nationalities VALUES(?,?)',[(row['id'],c) for c in row['countries']])
    generated=max(dates,default=None)
    version=hashlib.sha256(json.dumps(list(result.values()),sort_keys=True).encode()).hexdigest()[:24]
    metadata={'schema':1,'version':version,'generated':generated,'seasons':sorted({r['season'] for r in result.values()},reverse=True),'competitions':list(competitions.values()),'teams':list(teams.values()),'countries':countries,'qualification':rules,'records':len(result)}
    con.execute('INSERT OR REPLACE INTO stats_meta VALUES(?,?)',('catalogue',json.dumps(metadata,ensure_ascii=False)));con.commit();return metadata

def query(con,params):
    meta=json.loads(con.execute("SELECT value FROM stats_meta WHERE key='catalogue'").fetchone()[0])
    def one(k,d=None):return params.get(k,[d])[0]
    year=one('season',meta['seasons'][0]);where=['r.season=?'];args=[year]
    for key,col in [('competitions','competition'),('teams','team_id'),('positions','role')]:
        values=[v for v in params.get(key,[]) if v]
        if values:where.append('r.'+col+' IN (SELECT value FROM json_each(?))');args.append(json.dumps(values))
    nations=[v for v in params.get('countries',[]) if v]
    if nations:where.append('EXISTS (SELECT 1 FROM stats_nationalities n WHERE n.row_id=r.id AND n.country IN (SELECT value FROM json_each(?)))');args.append(json.dumps(nations))
    if one('q'):where.append('instr(r.search_name,?)>0');args.append(fold(one('q')))
    base=' FROM stats_rows r WHERE '+' AND '.join(where)
    count,qualified=con.execute('SELECT count(*),coalesce(sum(r.qualified),0)'+base,args).fetchone()
    if one('qualified','1')=='1':base+=' AND r.qualified=1'
    sort=one('sort','ppg');sort=sort if sort in METRICS+['name','team_id','role'] else 'ppg'
    direction='ASC' if one('direction')=='asc' else 'DESC'
    try:size=int(one('size',50));page=int(one('page',1))
    except (ValueError,TypeError):raise ValueError('Invalid pagination') from None
    if size not in [25,50,100] or not 1<=page<=100000:raise ValueError('Invalid pagination')
    rows=con.execute('SELECT r.payload'+base+' ORDER BY r.'+sort+' IS NULL ASC,r.'+sort+' '+direction+',r.id ASC LIMIT ? OFFSET ?',[*args,size,(page-1)*size]).fetchall()
    fields=[k for k in str(one('fields','g,mpg,ppg,rpg,apg,spg,bpg,topg,fgp,f3p,ftp')).split(',') if k in METRICS]
    projected=[]
    for item in rows:
        r=json.loads(item[0]);r['metrics']={k:r['metrics'].get(k) for k in fields};r.pop('pct',None);projected.append(r)
    return {'version':meta['version'],'generated':meta['generated'],'season':year,'total':qualified if one('qualified','1')=='1' else count,'records':count,'qualified':qualified,'page':page,'size':size,'rows':projected}
