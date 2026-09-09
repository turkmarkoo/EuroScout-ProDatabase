/* Search keys only; never changes stored names or identifiers. */
function searchFold(value){return String(value==null?'':value).replace(/[đĐ]/g,'dj').replace(/[łŁ]/g,'l').replace(/[øØ]/g,'o').replace(/[æÆ]/g,'ae').replace(/[œŒ]/g,'oe').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
