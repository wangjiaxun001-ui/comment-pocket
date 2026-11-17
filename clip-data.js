function cleanSpokenClip(c){
 if(!c||typeof c.id!=='string'||!/^\d{10,22}$/.test(c.id)||typeof c.t!=='string'||!c.t.trim()||c.t.length>5000||
 !Number.isFinite(c.s)||!Number.isFinite(c.e)||c.s<0||c.e<=c.s||c.e>86400)return null;
 return {id:c.id,s:c.s,e:c.e,t:c.t.trim(),title:String(c.title||'抖音作品').slice(0,240)}
}
const spokenTime=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
const spokenUrl=c=>'https://www.douyin.com/video/'+c.id;
const clipPrefix='pocket-spoken-v1:';
function clipKey(card,c){return clipPrefix+JSON.stringify([card,c.id,Math.round(c.s*1000),Math.round(c.e*1000)])}
function cardClips(card){
 const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
 if(!k?.startsWith(clipPrefix))continue;
 try{if(JSON.parse(k.slice(clipPrefix.length))[0]===card){const c=cleanSpokenClip(JSON.parse(localStorage.getItem(k)));if(c)out.push(c)}}catch{}}
 return out.sort((a,b)=>a.id.localeCompare(b.id)||a.s-b.s)
}
