/* Source statistics and current rosters are separate; private notes are never imported here. */
(function(){
'use strict';
const pack=window.EUROSCOUT_EXPANSION_DATA,rosters=new Map();
for(const r of pack?.roster||[])for(const id of r.ids)if(!rosters.has(id))rosters.set(id,r);
const statKeys=['ppg','rpg','apg','spg','bpg','topg','orpg','drpg','fgp','f3p','ftp','efg','ts','pir','eff','mpg','pts40','reb40','ast40','stl40','blk40','tov40'];
function apply(raw){if(!raw?.leagues||!pack)return;const directory=window.EUROSCOUT_CLUB_DIRECTORY||(window.EUROSCOUT_CLUB_DIRECTORY=[]),have=new Set(directory.map(t=>t.id));for(const t of pack.teams)if(!have.has(t.id)){directory.push({...t,aliases:[...(t.aliases||[])]});have.add(t.id);}
for(const source of pack.leagues){let l=raw.leagues.find(l=>l.meta.id===source.meta.id);if(!l){l={meta:{...source.meta},teams:[],players:[],statMeta:{}};raw.leagues.push(l);}const teams=new Set(l.teams.map(t=>t.code)),players=new Map(l.players.map(p=>[p.id,p]));for(const t of source.teams)if(!teams.has(t.code)){l.teams.push({...t});teams.add(t.code);}let changed=false;for(const p of source.players){const old=players.get(p.id);if(!old){const copy={...p,pct:{...p.pct},z:{...p.z},arch:[...(p.arch||[])],gameLog:[...(p.gameLog||[])]};l.players.push(copy);players.set(p.id,copy);changed=true;}}
if(!changed&&l.meta.expansionVersion===pack.checkedAt)continue;
for(const k of statKeys){const vals=l.players.filter(p=>p.qualified&&Number.isFinite(p[k])).map(p=>p[k]).sort((a,b)=>a-b);if(!vals.length)continue;const mean=vals.reduce((a,b)=>a+b,0)/vals.length,sd=Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length);l.statMeta=l.statMeta||{};l.statMeta[k]={mean,sd};for(const p of l.players){p.pct=p.pct||{};p.z=p.z||{};if(!Number.isFinite(p[k])){p.pct[k]=null;p.z[k]=null;continue;}let low=0,high=vals.length;while(low<high){const mid=(low+high)>>1;if(vals[mid]<=p[k])low=mid+1;else high=mid;}p.pct[k]=100*low/vals.length;p.z[k]=sd?(p[k]-mean)/sd:0;}}
Object.assign(l.meta,{playerCount:l.players.length,qualifiedCount:l.players.filter(p=>p.qualified).length,expansionVersion:pack.checkedAt,source:source.meta.source,statsScope:source.meta.statsScope});
}}
function record(p){return rosters.get(p.id)||(p._grp||[]).map(x=>rosters.get(x.id)).find(Boolean);}
function key(p){const r=record(p);return r?canonKey('directory|'+r.club):null;}
function link(uni){for(const pair of pack?.links||[])uni(...pair);}
window.EuroScoutExpansion={apply,key,link,record};
})();
