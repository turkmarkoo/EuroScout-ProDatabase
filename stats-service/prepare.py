"""Build/import a private read projection atomically. Never write private data into the app tree."""
import argparse,json,os,sqlite3,time
from contextlib import closing
from pathlib import Path
from catalogue import build,query

def prepare(sources,countries,destination,export_sql=False):
    destination=Path(destination).resolve();public=Path(__file__).resolve().parents[1]
    if destination.is_relative_to(public):raise ValueError('Keep private statistics outside the public repository')
    destination.parent.mkdir(parents=True,exist_ok=True);temporary=destination.with_suffix('.building.sqlite')
    if temporary.exists():temporary.unlink()
    started=time.perf_counter()
    with closing(sqlite3.connect(temporary)) as con:
        meta=build(con,sources,countries)
        samples=[]
        for params in [{},{'q':['dejour']},{'competitions':['euroleague','eurocup'],'positions':['Guard','Forward']},{'countries':['SI','HR']},{'season':['2025/26']},{'sort':['apg'],'page':['2']}]:
            start=time.perf_counter();r=query(con,params);samples.append({'params':params,'records':r['total'],'ms':round((time.perf_counter()-start)*1000,2)})
        if export_sql:
            target=destination.with_suffix('.sql');tmp=target.with_suffix('.sql.tmp')
            with tmp.open('w',encoding='utf-8') as file:
                for line in con.iterdump():
                    if line in ('BEGIN TRANSACTION;','COMMIT;'):continue
                    if line.startswith('INSERT INTO "stats_meta"'):
                        for key,value in con.execute('SELECT key,value FROM stats_meta'):
                            quote=lambda v:"'"+str(v).replace("'","''")+"'"
                            file.write('INSERT INTO stats_meta VALUES('+quote(key)+",'');\n")
                            for start in range(0,len(value),8000):file.write('UPDATE stats_meta SET value=value||'+quote(value[start:start+8000])+' WHERE key='+quote(key)+';\n')
                    else:
                        if len(line.encode('utf-8'))>=100000:raise ValueError('A statistics row exceeds the D1 import statement limit')
                        file.write(line+'\n')
            os.replace(tmp,target)
    os.replace(temporary,destination)
    return {'records':meta['records'],'version':meta['version'],'seasons':meta['seasons'],'buildSeconds':round(time.perf_counter()-started,2),'queries':samples,'databaseBytes':destination.stat().st_size}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',action='append',required=True);p.add_argument('--countries',required=True);p.add_argument('--out',required=True);p.add_argument('--sql',action='store_true');a=p.parse_args()
    sources=[json.loads(Path(f).read_text(encoding='utf-8')) for f in a.source];countries=json.loads(Path(a.countries).read_text(encoding='utf-8'))
    print(json.dumps(prepare(sources,countries,a.out,a.sql)))
