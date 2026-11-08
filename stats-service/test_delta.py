import json,sqlite3,tempfile,unittest
from contextlib import closing
from pathlib import Path
from catalogue import build,query
from delta import export

class DeltaTests(unittest.TestCase):
 def test_incremental_import_and_failure_preservation(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);a=root/'a.sqlite';b=root/'b.sqlite';sql=root/'change.sql'
   def make(path,pts,stamp):
    with closing(sqlite3.connect(path)) as con:build(con,[{'generated':stamp,'leagues':[{'meta':{'id':'test','name':'Test','season':'2026/27'},'teams':[{'code':'A','name':'A'}],'players':[{'id':'p','name':'Player','team':'A','g':3,'ppg':pts,'qualified':True}]}]}],[])
   make(a,12,'2026-11-07');make(b,12,'2026-11-08');self.assertEqual(export(a,b,sql)['addedOrChanged'],0)
   b.unlink();make(b,15,'2026-11-08');self.assertEqual(export(a,b,sql)['addedOrChanged'],1)
   with closing(sqlite3.connect(a)) as con:
    con.executescript(sql.read_text(encoding='utf-8'));self.assertEqual(query(con,{})['rows'][0]['metrics']['ppg'],15)
   with closing(sqlite3.connect(b)) as con:con.execute('DELETE FROM stats_rows');con.commit()
   with self.assertRaises(ValueError):export(a,b,sql)
   self.assertLess(max(len(line.encode()) for line in sql.read_text(encoding='utf-8').splitlines()),100000)

if __name__=='__main__':unittest.main()
