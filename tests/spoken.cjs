const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function harness(){
 const session=new Map(),permanent=new Map(),cards=[{key:'old-a',fields:{title:'甲'},evidence:[]},{key:'old-b',fields:{title:'乙'},evidence:[]}],els={};
 permanent.set('model',JSON.stringify({cards}));
 const el=id=>els[id]??={dataset:{},replaceChildren(){this.options=[]},add(value){this.options.push(value)},showModal(){this.open=true},close(){this.open=false;this.onclose?.()},children:[],options:[]};
 const pages=[],ctx=vm.createContext({console,URL,crypto:require('node:crypto').webcrypto,Option:class{constructor(text,value){this.text=text;this.value=value}},changeView(){},openSavedCard(key){ctx.openedCard=key},history:{replaceState(){}},location:{pathname:'/index.html'},window:{addEventListener(){}},drawCards(){},tell(){},$:el,model:{cards},pointer:'model',
 localStorage:{key:i=>[...permanent.keys()][i],get length(){return permanent.size},getItem:k=>permanent.get(k)??null,setItem:(k,v)=>permanent.set(k,v)},
 chrome:{runtime:{onMessageExternal:{addListener:f=>ctx.receiver=f},getURL:k=>'chrome-extension://pocket/'+k},
 storage:{session:{set:async o=>Object.entries(o).forEach(([k,v])=>session.set(k,v)),get:async k=>({[k]:session.get(k)}),remove:async k=>session.delete(k)}},tabs:{create:async({url})=>pages.push(url)}}});
 vm.runInContext(read('clip-data.js')+'\n'+read('clips-worker.js')+'\n'+read('clip-ui.js'),ctx);
 return {ctx,session,permanent,pages,el,run:s=>vm.runInContext(s,ctx)}
}
const clip={id:'7701656133378788644',s:12.345,e:18.75,t:'合成测试片段（非视频原话）',title:'测试'};
test('paired sender → choose existing card → persistent exact clip; duplicate, target isolation, cancellation',async()=>{
 const h=harness(),orig=h.permanent.get('model');
 const offer=async(c=clip)=>{assert.deepEqual((await new Promise(r=>h.ctx.receiver({op:'offer-spoken-clip',clip:c},{id:'kjgekajeeapmboeanokamomecbnpalah'},r))).ok,true);
 const key=h.pages.at(-1).split('#')[1];await h.ctx.chooseSpokenClip(key);assert.equal(h.el('spokenDialog').open,true);return key};
 const pick=target=>{h.el('spokenTarget').value=target;h.el('spokenTarget').onchange();h.el('spokenSave').onclick()};
 await offer();pick('old-b');await offer();pick('old-b');await offer({...clip,s:20,e:22});h.el('spokenDialog').close();
 assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.cardClips('old-b'))),[clip]);assert.equal(h.ctx.cardClips('old-a').length,0);
 assert.equal(h.permanent.get('model'),orig);assert.equal(h.session.size,0);assert.equal(h.ctx.openedCard,'old-b')
});
test('invalid times, arbitrary URLs, missing source and unpaired senders cannot open chooser',async()=>{
 const h=harness();for(const c of [{...clip,s:NaN},{...clip,e:clip.s},{...clip,id:'https://example.com'}, {...clip,t:''}]){
 assert.equal(h.ctx.cleanSpokenClip(c),null)}
 assert.equal(h.ctx.receiver({op:'offer-spoken-clip',clip},{id:'other'},()=>assert.fail()),undefined);
 assert.equal(h.pages.length,0)
});
test('seek selects visible video, verifies its time and refuses different work',async()=>{
 const h=harness();Object.assign(h.ctx,{innerWidth:800,innerHeight:600,setTimeout,location:new URL('https://www.douyin.com/video/'+clip.id)});
 const v={currentTime:0,readyState:4,duration:120,isConnected:true,seeking:false,getBoundingClientRect:()=>({left:0,right:600,top:0,bottom:400})};
 const hidden={...v,getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0})};
 h.ctx.document={querySelectorAll:()=>[hidden,v]};assert.equal(await h.ctx.seekSpokenWork(clip.id,12.345),true);assert.equal(v.currentTime,12.345);assert.equal(hidden.currentTime,0);
 assert.equal(await h.ctx.seekSpokenWork('12345678911',60),false);assert.equal(v.currentTime,12.345)
});

test('archived cards are excluded and a card archived while choosing rejects the incoming clip',async()=>{
 const h=harness();h.ctx.model.cards[0].archived=true;
 h.permanent.set('model',JSON.stringify(h.ctx.model));
 h.session.set('pending',clip);await h.ctx.chooseSpokenClip('pending');
 assert.equal(h.el('spokenTarget').options.some(o=>o.value==='old-a'),false);
 assert.equal(h.el('spokenTarget').options.some(o=>o.value==='old-b'),true);
 h.ctx.model.cards[1].archived=true;h.permanent.set('model',JSON.stringify(h.ctx.model));
 h.el('spokenTarget').value='old-b';h.el('spokenSave').onclick();
 assert.equal(h.ctx.cardClips('old-b').length,0);assert.equal(h.ctx.openedCard,undefined);
 assert.equal(h.el('spokenDialog').open,true);
});
