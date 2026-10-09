const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),files=['data/leagues_ncaa.json','data/leagues_pro.json','ncaa-rosters.json'];
const ncaa=JSON.parse(fs.readFileSync(path.join(root,files[2]),'utf8'));
const columns=['id','name','league','statsSeason','team','teamName','born','height','country','role','birthDate','realgmId','profile_url'];
const rows=[];for(const file of files.slice(0,2))for(const L of JSON.parse(fs.readFileSync(path.join(root,file),'utf8')).leagues)for(const p of L.players){const extra=L.meta.id==='ncaam'?ncaa.records[p.id]:null;const row={...p,league:L.meta.id,statsSeason:L.meta.season,height:p.height||extra?.height||null};rows.push(columns.map(k=>row[k]??null));}
const data={schema:1,season:'2025/26',sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),columns,rows};
const output=JSON.stringify(data);fs.writeFileSync(path.join(root,'data/arrival-evidence-2026.json'),output);console.log('Built '+rows.length+' read-only history records, '+Buffer.byteLength(output)+' bytes; original source files are unchanged.');
