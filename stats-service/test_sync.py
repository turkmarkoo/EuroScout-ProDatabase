import json,sqlite3,tempfile,unittest
from pathlib import Path
from contextlib import closing
from catalogue import build
from sync import defer_historical_additions,estimate_writes,wrangler_result
from delta import export

class RefreshTests(unittest.TestCase):
 def test_import_response_with_progress_and_stray_brackets(self):
  result=[{'success':True,'meta':{'rows_written':808},'results':[]}]
  self.assertEqual(wrangler_result('[WARNING] import starting\nProcessed 692 queries.\n'+json.dumps(result)+'\n'),result)
  with self.assertRaises(ValueError):wrangler_result('[WARNING] incomplete\n[]')
  with self.assertRaises(ValueError):wrangler_result('[{"success":false,"meta":{}}]')
 def test_free_limit_staging_keeps_published_history_and_all_current_records(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);a=root/'old.sqlite';b=root/'candidate.sqlite';c=root/'limited.sqlite';sql=root/'delta.sql'
   def league(year,players):return {'meta':{'id':'test','name':'Test','season':year},'teams':[{'code':'A','name':'A'}],'players':[{'id':id,'name':id,'team':'A','g':3,'ppg':pts,'qualified':True} for id,pts in players]}
   for target,leagues in [(a,[league('2025/26',[('old-history',10)]),league('2026/27',[('current',12)])]),(b,[league('2025/26',[('old-history',10),('new-history',8)]),league('2026/27',[('current',15),('new-current',11)])])]:
    with closing(sqlite3.connect(target)) as con:build(con,[{'generated':'2026-11-08','leagues':leagues}],[])
   meta=defer_historical_additions(a,b,c,'2026/27')
   self.assertEqual(meta['coverage']['historicalPending'],1);self.assertEqual(meta['records'],3)
   with closing(sqlite3.connect(c)) as con:
    rows=[json.loads(r[0]) for r in con.execute('SELECT payload FROM stats_rows')]
   self.assertEqual({r['name'] for r in rows},{'old-history','current','new-current'})
   self.assertEqual(next(r['metrics']['ppg'] for r in rows if r['name']=='current'),15)
   self.assertEqual(export(a,c,sql)['removed'],0);self.assertLess(estimate_writes(a,c,sql),100)
   with closing(sqlite3.connect(a)) as con:con.executescript(sql.read_text(encoding='utf-8'))
   self.assertEqual(export(a,b,sql)['addedOrChanged'],1)

if __name__=='__main__':unittest.main()
