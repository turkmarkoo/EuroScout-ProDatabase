"""Write an incremental private D1 import against the last successfully published snapshot."""
import argparse,json,sqlite3
from contextlib import closing
from pathlib import Path

def literal(con,value):return con.execute('SELECT quote(?)',(value,)).fetchone()[0]
def semantic(row):
    data=json.loads(row['payload']);data.pop('updated',None);return data

def export(previous,current,target,allow_removals=False):
    with closing(sqlite3.connect('file:'+Path(previous).resolve().as_posix()+'?mode=ro',uri=True)) as old,closing(sqlite3.connect('file:'+Path(current).resolve().as_posix()+'?mode=ro',uri=True)) as new:
        old.row_factory=new.row_factory=sqlite3.Row
        before={r['id']:r for r in old.execute('SELECT * FROM stats_rows')};after={r['id']:r for r in new.execute('SELECT * FROM stats_rows')}
        changed=[id for id,row in after.items() if id not in before or semantic(row)!=semantic(before[id])];removed=before.keys()-after.keys()
        if removed and not allow_removals:raise ValueError('Rows disappeared. Preserve the last good data and review the source/correction before allowing removals.')
        columns=[r['name'] for r in new.execute('PRAGMA table_info(stats_rows)')];statements=[]
        for id in sorted(removed):
            key=literal(new,id);statements+=['DELETE FROM stats_nationalities WHERE row_id='+key+';','DELETE FROM stats_rows WHERE id='+key+';']
        for id in changed:
            row=after[id];values=','.join(literal(new,row[c]) for c in columns);assign=','.join(c+'=excluded.'+c for c in columns if c!='id')
            statements.append('INSERT INTO stats_rows('+','.join(columns)+') VALUES('+values+') ON CONFLICT(id) DO UPDATE SET '+assign+';')
            statements.append('DELETE FROM stats_nationalities WHERE row_id='+literal(new,id)+';')
            for country in new.execute('SELECT country FROM stats_nationalities WHERE row_id=?',(id,)):statements.append('INSERT INTO stats_nationalities VALUES('+literal(new,id)+','+literal(new,country[0])+');')
        meta=new.execute("SELECT value FROM stats_meta WHERE key='catalogue'").fetchone()[0]
        statements.append("UPDATE stats_meta SET value='' WHERE key='catalogue';")
        for start in range(0,len(meta),8000):statements.append("UPDATE stats_meta SET value=value||"+literal(new,meta[start:start+8000])+" WHERE key='catalogue';")
        if any(len(s.encode())>=100000 for s in statements):raise ValueError('Import statement exceeds D1 limits')
        Path(target).write_text('\n'.join(statements)+'\n',encoding='utf-8')
        return {'addedOrChanged':len(changed),'removed':len(removed),'statements':len(statements),'bytes':Path(target).stat().st_size}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('previous');p.add_argument('current');p.add_argument('output');p.add_argument('--allow-removals',action='store_true');a=p.parse_args();print(json.dumps(export(a.previous,a.current,a.output,a.allow_removals)))
