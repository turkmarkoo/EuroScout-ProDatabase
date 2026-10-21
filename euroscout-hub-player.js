/* Explicit, acknowledged player navigation from the authorized Hub frame. */
(function(){'use strict';
const HUB='https://dragonshub.mtscouting.com';let pending=null;
function matches(id){if(typeof CURRENT==='undefined'||!DRAWER_OPEN)return false;const p=player(CURRENT);return !!p&&[p.id,...(p._grp||[]).map(x=>x.id)].includes(id);}
function acknowledge(){if(!pending||!matches(pending.id))return;parent.postMessage({type:'euroscout:player-opened',id:pending.id,requestId:pending.requestId},HUB);pending=null;}
function open(){
 if(!pending||!window.EuroScoutPlayerRoutesReady||!window.ESAccess?.internal)return;
 if(location.hash!=='#p='+encodeURIComponent(pending.id)){parent.postMessage({type:'euroscout:player-cancelled',id:pending.id,requestId:pending.requestId},HUB);pending=null;return;}
 acknowledge();if(!pending)return;
 openFromHash(location.hash,true);acknowledge();
}
window.addEventListener('message',e=>{
 const m=e.data;
 if(parent===window||e.source!==parent||e.origin!==HUB||m?.type!=='hub:player-open'||typeof m.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,160}$/.test(m.id)||typeof m.requestId!=='string'||m.requestId.length>80)return;
 pending={id:m.id,requestId:m.requestId};
 // Do not navigate/reload the document or add intermediate browser history.
 history.replaceState(null,'',location.pathname+location.search+'#p='+encodeURIComponent(m.id));
 open();
});
window.addEventListener('euroscout:routes-ready',open);
window.addEventListener('euroscout:catalogue-ready',open);
window.addEventListener('euroscout:profile-opened',acknowledge);
})();
