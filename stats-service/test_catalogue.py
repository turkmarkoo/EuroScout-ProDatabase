import json,sqlite3,unittest
from catalogue import build,query,season

class QueryTests(unittest.TestCase):
    def setUp(self):
        self.c=sqlite3.connect(':memory:');countries=[{'id':'SI','name':'Slovenia','aliases':['SVN']},{'id':'HR','name':'Croatia'}]
        def league(id,year,players):return {'meta':{'id':id,'name':id,'season':year,'minGames':5,'minMpg':10},'teams':[{'code':'A','name':'Club A'},{'code':'B','name':'Club B'}],'players':players}
        def p(id,name=None,**values):return {'id':id,'name':name or ('One Player' if id in ('one','current','another-id') else id),'team':'A','g':6,'mpg':20,'ppg':10,'role':'Guard','country':'SVN','qualified':True,**values}
        sources=[{'leagues':[league('euroleague','2025/26',[p('one',ppg=99)]),league('euroleague','2026/27',[p('one'),p('same-name-2002','Marcus Foster',born=2002),p('same-name-1995','Marcus Foster',born=1995),p('not-qualified',g=2),p('absent-season-stats',g=0),p('dejour',"De’Jour Reaves",country=['Slovenia','Croatia']),p('zero',ppg=0)]),league('eurocup','2026/27',[p('another-id',linkedEuroScoutId='one',ppg=20,role='Forward')])]}, {'leagues':[league('euroleague','2026/27',[p('current',linkedEuroScoutId='one',ppg=11,dragonsTotals={'pts':66,'fgm':20,'fga':50,'p3m':5,'p3a':20,'ftm':21,'fta':30})])]}]
        self.meta=build(self.c,sources,countries)
    def tearDown(self):self.c.close()
    def q(self,**p):return query(self.c,{k:v if isinstance(v,list) else [str(v)] for k,v in p.items()})
    def test_season_and_cross_competition(self):
        rows=self.q(q='One Player',qualified=0)['rows'];self.assertEqual(len(rows),2);self.assertEqual({r['metrics']['ppg'] for r in rows},{11,20});self.assertEqual(self.q(season='2025/26')['rows'][0]['metrics']['ppg'],99)
    def test_same_names_are_separate(self):self.assertEqual(self.q(q='Marcus Foster')['total'],2)
    def test_multi_filter_and_dual_nationality(self):
        self.assertEqual(self.q(competitions=['euroleague','eurocup'],positions=['Guard','Forward'],countries=['HR'])['rows'][0]['name'],'De’Jour Reaves')
        self.assertEqual(self.q(competitions=['eurocup'],positions=['Big'])['total'],0)
    def test_qualification_is_separate(self):self.assertEqual(self.q(q='not')['total'],0);self.assertEqual(self.q(q='not',qualified=0)['total'],1)
    def test_punctuation_search(self):self.assertEqual(self.q(q='dejour')['total'],1)
    def test_zero_unknown_totals_and_fields(self):
        self.assertEqual(self.q(q='zero')['rows'][0]['metrics']['ppg'],0)
        r=self.q(q='One Player',competitions=['euroleague'],fields='t_pts,t_reb,ts,efg')['rows'][0];self.assertEqual(r['metrics']['t_pts'],66);self.assertIsNone(r['metrics']['t_reb']);self.assertAlmostEqual(r['metrics']['efg'],45);self.assertNotIn('gameLog',r);self.assertNotIn('ppg',r['metrics'])
    def test_whole_set_sort_and_validation(self):
        self.assertEqual(self.q(sort='ppg')['rows'][0]['metrics']['ppg'],20)
        with self.assertRaises(ValueError):self.q(size=1000)
        self.assertEqual(self.q(sort='ppg;DROP TABLE stats_rows')['rows'][0]['metrics']['ppg'],20)
    def test_explicit_calendar_season(self):self.assertEqual(season('2026'),'2026');self.assertIsNone(season(None));self.assertEqual(season('2026/2027'),'2026/27')
    def test_partial_logs_do_not_replace_source_totals(self):
        source={'leagues':[{'meta':{'id':'test','name':'Test','season':'2026/27'},'teams':[],'players':[{'id':'p','name':'Partial','team':'A','g':6,'ppg':11,'mpg':20,'qualified':True,'_logCount':1,'t_pts':999,'t_reb':100,'min':20,'dragonsTotals':{'pts':66}}]}]}
        build(self.c,[source],[]);row=self.q(fields='t_pts,t_reb,t_min')['rows'][0];self.assertEqual(row['metrics']['t_pts'],66);self.assertIsNone(row['metrics']['t_reb']);self.assertIsNone(row['metrics']['t_min'])
    def test_mixed_metric_samples_keep_published_averages(self):
        source={'leagues':[{'meta':{'id':'swiss','name':'Swiss','season':'2026/27'},'teams':[],'players':[{'id':'p','name':'Partial','team':'A','g':7,'ppg':43/7,'mpg':161/6,'apg':2.5,'topg':1,'qualified':True,'statisticsCoverage':{'partial':True,'metricGames':{'mpg':6,'ppg':7,'apg':6}},'dragonsTotals':{'pts':43,'min':161,'fgm':16,'fga':40,'p3m':1,'fta':10}}]}]}
        build(self.c,[source],[]);row=self.q(fields='ppg,mpg,t_min,ts,pts40,astto')['rows'][0]
        self.assertAlmostEqual(row['metrics']['mpg'],161/6);self.assertEqual(row['metrics']['t_min'],161)
        for key in ['ts','pts40','astto']:self.assertIsNone(row['metrics'][key])
        self.assertEqual(row['coverage']['metricGames']['mpg'],6)

if __name__=='__main__':unittest.main()
