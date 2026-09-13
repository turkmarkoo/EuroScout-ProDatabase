/* Reviewed 2026/27 moves. Stable database IDs prevent namesake assignments. */
(function(){
  const records=[
{"id":"maintenance-20260908-nikola-rebic-fmp","player":"Nikola Rebić","from":"Spartak Office Shoes","to":"FMP","status":"signed","pos":"PG","league":"ABA League","contract":null,"source_url":"https://www.aba-liga.com/news/55134/two-time-aba-league-champion-nikola-rebic-returns-to-fmp/","source_name":"ABA League","summary":"Rebić returns to FMP after playing for Spartak last season. Contract duration was not specified.","date":"2026-09-08","date_basis":"report_date","verified_at":"2026-09-13","added_at":"2026-09-09T07:56:37.822Z","playerId":"aba-2312","autoApply":true},
{"id":"maintenance-20260908-beau-beech-zastal","player":"Beau Beech","from":"Zadar","to":"ORLEN Zastal Zielona Góra","status":"signed","pos":"F","league":"PLK","contract":"Through 2026/27","source_url":"https://plk.pl/aktualnosci/27401/beau-beech-wraca-do-plk","source_name":"Polska Liga Koszykówki","summary":"Beech returns to Poland after playing for Zadar. The club announcement reproduced by Sportando specifies a contract through the end of the season.","date":"2026-09-08","date_basis":"report_date","verified_at":"2026-09-13","sources":[{"url":"https://sportando.basketball/en/beau-beech-joins-zastal-zielona-gora/","name":"Sportando (club contract announcement)"}],"added_at":"2026-09-09T07:56:37.822Z","playerId":"aba-4140","autoApply":true},
{"id":"maintenance-20260908-langston-galloway-trieste","player":"Langston Galloway","from":"Esenler Erokspor","to":"Pallacanestro Trieste","status":"signed","pos":"G","league":"Lega Basket","contract":null,"source_url":"https://www.pallacanestrotrieste.it/news/547341372934/langston-galloway-un-nuovo-giocatore-della-pallacanestro-trieste","source_name":"Pallacanestro Trieste","summary":"Trieste announced the signing of Galloway, who last played for Esenler Erokspor. Contract duration was not specified.","date":"2026-09-08","date_basis":"announcement_date","verified_at":"2026-09-13","added_at":"2026-09-09T07:56:37.822Z","updated_at":"2026-09-10T07:36:38.891Z","history":[{"id":"maintenance-20260908-langston-galloway-trieste","player":"Langston Galloway","from":"?","to":"Pallacanestro Trieste","status":"rumor","pos":"G","league":"Lega Basket","contract":null,"source_url":"https://backdoorpodcast.com/trieste-accordo-langston-galloway/","source_name":"Backdoor Podcast","summary":"Reported agreement in principle, citing Il Piccolo; an official club announcement is still awaited.","date":"2026-09-08","date_basis":"report_date","verified_at":"2026-09-09","added_at":"2026-09-09T07:56:37.822Z"}],"sources":[{"url":"https://backdoorpodcast.com/trieste-accordo-langston-galloway/","name":"Backdoor Podcast (earlier rumor report)"}],"playerId":"bsl-0090","autoApply":true},
{"id":"maintenance-20260910-jamarques-lawrence-pecs","player":"Jamarques Lawrence","from":"Nebraska Cornhuskers","to":"NKA Universitas Pécs","status":"signed","pos":"PG","league":"Hungarian NB1","date":"2026-09-08","source_url":"https://bball1.hu/fiatal-amerikai-legiost-igazolt-az-nka/","source_name":"BB1.hu","summary":"Lawrence joins Pécs from Nebraska following Kobe Elvis’s injury. Contract duration was not specified.","contract":null,"date_basis":"report_date","verified_at":"2026-09-13","added_at":"2026-09-10T07:36:38.891Z","playerId":"ncaam-1323","autoApply":true},
{"id":"maintenance-20260910-pavle-djurisic-kecskemet","player":"Pavle Đurišić","from":"?","to":"Kecskemét","status":"signed","pos":"PF","league":"Hungarian NB1","date":"2026-09-09","source_url":"https://bball1.hu/bejelentette-negyedik-legiosat-a-kecskemet/","source_name":"BB1.hu","summary":"Kecskemét announced the Montenegrin power forward. The report mentions clubs in Bulgaria and Montenegro last season but does not establish his immediate previous team.","contract":null,"date_basis":"report_date","verified_at":"2026-09-13","added_at":"2026-09-10T07:36:38.891Z","playerId":"aba2-0084","autoApply":true},
    {id:'review-20260913-green',player:'Erick Green',playerId:'lba-2534',birth_year:1991,to:'Umana Reyer Venezia',date:'2026-09-11',source_url:'https://www.reyer.it/news/maschile/2026-09-11/umana-reyer-esperienza-e-talento-per-il-reparto-esterni-firmato-erick-green/'},
    {id:'review-20260913-ray',player:'Kendrick Ray',playerId:'gbl-0B4BA1C7',birth_year:1994,to:'Brindisi',date:'2026-09-10',source_url:'https://www.basketinside.com/europe-basketball/mercato-europe-basketball/ufficiale-brindisi-annuncia-kendrick-ray/'},
    {id:'review-20260913-dejulius',player:'David Dejulius',playerId:'acb-30003940',birth_year:1999,to:'Besiktas Istanbul',date:'2026-09-12',contract:'One-season loan from UCAM Murcia',source_url:'https://www.eurohoops.net/en/fiba-champions-league/2007172/ucam-murcia-confirms-dejuliuss-contract-with-the-club-and-his-loan-to-besiktas/'},
    {id:'review-20260913-vuurst',player:'Keye Van der Vuurst',playerId:'bsl-0069',birth_year:2001,to:'SAFİPORT EROKSPOR',date:'2026-09-10',source_url:'https://www.turkiyebasket.com/esenler-erokspor-bsl-asist-krali-van-der-vuurst-transfer/'},
    {id:'review-20260913-wright',player:'Ethan Wright',playerId:'britain-rg135848-rgteam-955',to:'SZTE-Szedeák',date:'2026-09-09',contract:'Temporary replacement until Andrew Henderson recovers',source_url:'https://bball1.hu/amerikai-hatveddel-kotott-rovid-tavu-szerzodest-a-szedeak/'}
  ].map(r=>({...r,status:'signed',autoApply:true,verified_at:'2026-09-13',source_name:'Transfer review · 13 September 2026'}));
  const blocked=new Set(['hun26-61812d9b']);
  const originalIds={'review-20260913-green':'maintenance-20260912-green-venezia','review-20260913-ray':'maintenance-20260912-ray-brindisi','review-20260913-dejulius':'maintenance-20260912-dejulius-besiktas','review-20260913-vuurst':'maintenance-20260912-vuurst-erokspor','review-20260913-wright':'maintenance-20260913-ethan-wright-szedeak'};
  const rejected=r=>{const h=trHandledGet();return h[r.id]==='rejected'||h[originalIds[r.id]]==='rejected';};
  const clean=items=>(items||[]).filter(t=>t&&!blocked.has(t.id)&&!(normNm(t.player)==='bogdan bogdanovic'&&/ose|hungar/i.test(String(t.to)+' '+String(t.league))));
  function key(p){
    const ids=new Set([p.id,...(p._grp||[]).map(x=>x.id)]);
    const r=records.find(x=>ids.has(x.playerId));if(!r)return null;
    let newer=false;TRANSFERS.forEach(t=>{if(normNm(t.player)===normNm(r.player)&&t.date>r.date)newer=true;});if(newer)return null;
    // An explicit rejection, including the original feed item, always wins.
    const handled=trHandledGet();if(rejected(r))return null;
    let rejected=false;TRANSFERS.forEach(t=>{if(handled[t.id]==='rejected'&&normNm(t.player)===normNm(r.player))rejected=true;});
    if(rejected)return null;
    const club=dbTeamForClub(r.to);return club?canonKey(club.key):null;
  }
  function repair(){
    // Remove only the demonstrably false NBA -> OSE assignment, not unrelated edits.
    const p=(STATE.data?.leagues||[]).flatMap(l=>l.players||[]).find(p=>p.id==='nba-51');
    if(!p||normNm(p.name)!=='bogdan bogdanovic')return;
    const m=next26Get(),applied=autoAppliedGet(),wrong=dbTeamForClub('MVM-OSE Lions');let changed=false;
    for(const id of new Set([p.id,gid(p),...(p._grp||[]).map(x=>x.id)])){
      if(m[id]&&wrong&&canonKey(m[id])===canonKey(wrong.key)){delete m[id];delete applied[id];changed=true;}
    }
    if(changed){next26Set(m);autoAppliedSet(applied);}
  }
  window.EuroScoutTransferConfirmations={records,clean,key,repair,rejected};
})();
