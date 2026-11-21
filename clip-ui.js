// Executed in the chosen work tab. Only act on the visible player for that work.
async function seekSpokenWork(id,start){
 const sleep=ms=>new Promise(r=>setTimeout(r,ms)),deadline=Date.now()+28000;
 const same=()=>location.origin==='https://www.douyin.com'&&(new URL(location.href).searchParams.get('modal_id')||location.pathname.match(/^\/video\/(\d+)\/?$/)?.[1])===id;
 while(Date.now()<deadline&&same()){
  const score=v=>{const r=v.getBoundingClientRect();return Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left))*Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))};
  const v=[...document.querySelectorAll('video')].filter(v=>v.readyState>=1&&Number.isFinite(v.duration)&&v.duration>start&&score(v)>100).sort((a,b)=>score(b)-score(a))[0];
  if(v){try{v.currentTime=start;for(let i=0;i<20;i++){await sleep(100);if(!same())return false;if(v.isConnected&&!v.seeking&&Math.abs(v.currentTime-start)<1){return true}}}catch{}}
  await sleep(200)
 }
 return false
}
async function replaySpoken(c){
 if(!globalThis.chrome?.scripting){window.open(spokenUrl(c),'_blank','noopener');return tell('已打开原作品，请手动跳到 '+spokenTime(c.s))}
 try{
  const url=spokenUrl(c),matches=await chrome.tabs.query({currentWindow:true,url:url+'*'});
  const existing=matches.filter(t=>!t.discarded&&t.url?.split(/[?#]/)[0]===url).sort((a,b)=>Number(b.status==='complete')-Number(a.status==='complete')||(b.lastAccessed||0)-(a.lastAccessed||0))[0];
  const t=existing?await chrome.tabs.update(existing.id,{active:true}):await chrome.tabs.create({url});let verified=false;
  for(let i=0;i<80;i++){const tab=await chrome.tabs.get(t.id);if(tab.url?.split(/[?#]/)[0]===spokenUrl(c)){
    try{const [r]=await chrome.scripting.executeScript({target:{tabId:t.id},func:seekSpokenWork,args:[c.id,c.s]});verified=r?.result===true;break}catch{}
   }await new Promise(r=>setTimeout(r,250))}
  tell(verified?'已定位到 '+spokenTime(c.s):'未能自动定位。请在原作品跳到 '+spokenTime(c.s));return verified
 }catch{tell('未能定位播放器，请打开原作品并跳到 '+spokenTime(c.s));return false}
}
function referenceNoteEditor(cardKey, clip){
 const details=document.createElement('details'), label=document.createElement('summary');
 const input=document.createElement('textarea'), save=document.createElement('button');
 label.className='referenceLabel';
 const refresh=()=>{label.textContent=clip.note?'参考点：'+clip.note:'＋ 记参考点'};
 refresh();
 input.value=clip.note||'';input.rows=2;
 input.setAttribute('aria-label','这段口播的参考点');
 input.placeholder='想借鉴什么？例如：开头先交代试穿了多久';
 save.type='button';save.textContent='保存参考点';
 save.onclick=()=>{
  const key=clipKey(cardKey,clip),note=input.value.trim();
  try{
   const latest=cleanSpokenClip(JSON.parse(localStorage.getItem(key)));
   if(!latest)return tell('这段口播已移出，请重新打开选题卡');
   if(note)latest.note=note;else delete latest.note;
   localStorage.setItem(key,JSON.stringify(latest));
  }catch{return tell('参考点未能保存，请重试')}
  clip.note=note;input.value=note;refresh();details.open=false;
  filterSavedCards();tell(note?'参考点已保存':'参考点已清除');
 };
 details.append(label,input,save);return details
}
function showSpokenClips(box,c){
 const clips=cardClips(c.key);if(!clips.length)return;
 const area=document.createElement('section');area.className='spoken';const h=document.createElement('strong');h.textContent='参考口播 · '+clips.length+' 段';area.append(h);
 for(const clip of clips){const row=document.createElement('p'),b=document.createElement('button'),q=document.createElement('span'),meta=document.createElement('small');
 b.type='button';b.textContent='▶ '+spokenTime(clip.s);b.title='回看原视频 '+spokenTime(clip.s);b.onclick=async()=>{const ok=await replaySpoken(clip);if(ok!==undefined)meta.textContent=clip.title+' · '+(ok?'已定位到 '+spokenTime(clip.s):'未能自动定位到 '+spokenTime(clip.s))};
 q.textContent=clip.t;meta.textContent=clip.title;const remove=document.createElement('button');remove.type='button';remove.className='clipRemove';remove.textContent='移出片段';remove.onclick=()=>{
 const k=clipKey(c.key,clip);try{localStorage.removeItem(k);row.replaceChildren();const undo=document.createElement('button');undo.textContent='撤销移出';undo.onclick=()=>{try{localStorage.setItem(k,JSON.stringify(clip));drawCards()}catch{tell('恢复失败，请重试')}};row.append('片段已移出。 ',undo);h.textContent='参考口播 · '+cardClips(c.key).length+' 段';filterSavedCards()}catch{tell('移出失败，请重试')}};
 const copy=document.createElement('button');
 copy.type='button';
 copy.textContent='复制这段';
 copy.onclick=async()=>{
  const lines=[clip.t];
  if(clip.note)lines.push('参考点：'+clip.note);
  lines.push(clip.title+' · '+spokenTime(clip.s)+' – '+spokenTime(clip.e),spokenUrl(clip));
  try{
   await navigator.clipboard.writeText(lines.join('\n'));
   tell('已复制这段口播和出处');
  }catch{tell('浏览器未允许复制，请选中原话手动复制')}
 };
 row.append(b,q,meta,referenceNoteEditor(c.key,clip),copy,remove);area.append(row)}
 box.append(area)
}
async function chooseSpokenClip(key){
 const dlg=$('spokenDialog'),select=$('spokenTarget'),save=$('spokenSave'),hint=$('spokenHint');
 const clip=cleanSpokenClip((await chrome.storage.session.get(key))[key]);
 changeView('saved');
 if(!clip){tell('这次口播选择已失效，请回拾句重新选择。');return}
 $('spokenPreview').textContent=spokenTime(clip.s)+' – '+spokenTime(clip.e)+'　'+clip.t;
 $('spokenSource').textContent=clip.title;select.replaceChildren(new Option('请选择已有的选题卡',''));
 const related=c=>c.evidence?.some(r=>String(r.url||'').includes(clip.id));
 for(const c of [...model.cards].sort((a,b)=>Number(related(b))-Number(related(a))))select.add(new Option((related(c)?'同一作品 · ':'')+c.fields.title,c.key));
 hint.textContent=model.cards.length?'只保存这段原话、时间和作品来源。':'这里还没有已存选题。先存一张选题卡，再回拾句加入片段。';
 save.disabled=true;select.onchange=()=>{save.disabled=!select.value};
 dlg.onclose=()=>{chrome.storage.session.remove(key);history.replaceState(null,'',location.pathname+'#saved')};
 save.onclick=()=>{const target=select.value;try{const latest=JSON.parse(localStorage.getItem(pointer)||'{}');
 if(!latest.cards?.some(c=>c.key===target))return tell('这张卡已不存在，请重新选择。');
 const k=clipKey(target,clip),exists=localStorage.getItem(k)!==null;
 if(!exists)localStorage.setItem(k,JSON.stringify(clip));
 dlg.close();drawCards();const el=[...$('cards').children].find(x=>x.dataset.cardKey===target);el?.scrollIntoView({block:'center'});tell(exists?'这段口播已在卡里':'已加入选题卡')}
 catch{hint.textContent='保存失败，请确认本机存储空间后重试。'}};
 dlg.showModal()
}
window.addEventListener('storage',e=>{if(e.key?.startsWith(clipPrefix)&&tab==='saved'&&!editingCard)drawCards()});
