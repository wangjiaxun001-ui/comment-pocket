const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const isWeb = url => /^https?:\/\//i.test(url||'');
const anchor = (url,label) => isWeb(url) ? '<a class="ref" target="_blank" rel="noreferrer" href="'+esc(url)+'">'+esc(label)+'</a>' : esc(label);
const pointer = 'bandiaopai-pocket-v1';
let model;
try {model=JSON.parse(localStorage.getItem(pointer)||'{}')} catch {model={}}
for(const k of ['batches','cards','notes','works'])if(!Array.isArray(model[k]))model[k]=[];
let mode=model.batches.length?'mine':'sample',sort='hot',category='',active='',groups=[],tab='single',editingCard=null;
const drafts=new Map();
const allNotes=()=>[...libraryNotes,...model.notes];
const persist=()=>{try{localStorage.setItem(pointer,JSON.stringify(model));return true}catch{tell('当前浏览器未能保存，请先复制你的选题卡');return false}};
let toastTimer;
function tell(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800)}
function changeView(v){tab=v;for(const k of ['single','work','notes','saved','creators'])$(k).hidden=k!==v;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='creators')drawWorks();if(v==='notes')drawNotes();if(v==='saved')drawCards()}
function shootingGuide(g){
 const guides=[
  ['使用反馈','将使用前后的同一处放进同一画面，近拍变化最大的细节。','用了多久，第一次发现变化是在什么情况下？'],
  ['两样比较','把评论提到的两样东西并排，先对齐同一个细节，再揭晓差异。','你选择其中一个时，最在意哪一点？'],
  ['投稿点评','先展示投稿者希望得到反馈的部分，标出一处具体差别。','你希望改善的具体效果是什么？'],
  ['观众追问','先复述观众想看的动作，用一个连续镜头把过程演示完整。','哪一步在原视频里还没看清？'],
  ['具体求助','把观众提到的条件写在画面上，再展示一种符合条件的选择。','哪些条件一定要满足，哪些可以调整？']
 ];
 const found=guides.find(x=>g.labels.has(x[0]));
 return found?{shot:found[1],ask:found[2]}:{shot:'',ask:''}
}
function initialDraft(g){
 const hit=suggestedNotes(g,allNotes())[0];
 const guide=shootingGuide(g);
 return {title:g.title,shot:g.rule?.shot||guide.shot,ask:g.rule?.ask||guide.ask,note:hit?.n.text||'',noteTitle:hit?.n.title||'',noteUrl:hit?.n.url||''}
}
const groupKey=g=>mode+'::'+g.key;
function draft(g){
 const k=groupKey(g);
 if(!drafts.has(k))drafts.set(k,{...(model.cards.find(c=>c.key===k)?.fields||initialDraft(g))});
 return drafts.get(k)
}
function render(selectFirst=false){
 $('dataset').value=mode;$('savedCount').textContent=model.cards.length;$('noteCount').textContent=allNotes().length;
 const batches=mode==='sample'?samples:model.batches;
 groups=analyze(batches);
 const labels=[...new Set(groups.flatMap(g=>[...g.labels]))];if(!labels.includes(category))category='';
 $('category').innerHTML='<option value="">全部讨论类型</option>'+labels.map(x=>'<option>'+esc(x)+'</option>').join('');$('category').value=category;
 const topLikes=g=>Math.max(-1,...g.rows.filter(r=>!$('answeredTopics').checked||r.replies.some(t=>t.author)).map(r=>r.likes??-1));
 const visible=groups.filter(g=>(!category||g.labels.has(category))&&(!$('answeredTopics').checked||g.authorReply))
   .sort((a,b)=> (sort==='liked'?(topLikes(b)-topLikes(a)):0)||compareGroups(a,b,sort));
 if(selectFirst||!visible.some(g=>g.key===active))active=visible[0]?.key;
 const roots=batches.flatMap(b=>b.rows).filter(r=>!r.parent).length;
 const replies=batches.reduce((n,b)=>n+b.rows.length,0)-roots;
 $('coverage').textContent=(mode==='sample'?'样本摘录':'本机已收录')+' · '+batches.length+' 条作品 / '+roots+' 条主评 / '+replies+' 条回复';
 $('groupCount').textContent=visible.length+' 个';
 document.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sort===sort));
 $('topics').replaceChildren();
 for(const g of visible){
  const btn=document.createElement('button');btn.className='topic'+(active===g.key?' selected':'');
  btn.innerHTML='<span class="tag">'+esc([...g.labels][0])+'</span><b>'+esc(g.title)+'</b><small>'+esc(metrics(g))+'</small>';
  btn.onclick=()=>{active=g.key;render()};$('topics').append(btn)
 }
 const current=visible.find(g=>g.key===active);
 if(current)drawDetail(current);
 else $('detail').innerHTML='<h2>还没有候选话题</h2><p class="empty">点「加入评论」粘贴真实留言，或切换到试用样本。</p>';
}
function metrics(g){return (g.people?g.people+' 位可识别观众 · ':'')+g.roots+' 条主评 · '+g.replyCount+' 条回复'}
function evidenceRow(r){
 const replies=r.replies.map(t=>'<div class="reply"><b>'+ (t.author?'作者回复':'楼中楼')+'</b>　'+esc(t.text)+'</div>').join('');
 return '<div class="quote">'+esc(r.text)+(Number.isFinite(r.likes)?' <small>· '+workNumber(r.likes)+' 赞</small>':'')+replies+'<div class="meta">'+anchor(r.url,r.work)+'</div></div>'
}
function editor(f){
 return '<div class="edit"><label>我的选题<input data-field="title" value="'+esc(f.title)+'"></label><label>第一镜怎么拍<textarea rows="2" data-field="shot" placeholder="写下人物、物件和动作">'+esc(f.shot)+'</textarea></label><label>还想追问什么<input data-field="ask" value="'+esc(f.ask)+'" placeholder="给观众或采访对象留一个问题"></label></div>';
}
function bindFields(box,f){box.querySelectorAll('[data-field]').forEach(e=>e.oninput=()=>f[e.dataset.field]=e.value)}
function drawDetail(g){
 const f=draft(g),hits=suggestedNotes(g,allNotes());
 const shown=g.rows.filter(r=>!$('answeredTopics').checked||r.replies.some(t=>t.author));
 if(sort==='liked')shown.sort((a,b)=>(b.likes??-1)-(a.likes??-1));
 const proof=shown.map(evidenceRow);
 const route='按原话和拍法提示编辑，保存后可继续改稿';
 $('detail').innerHTML='<span class="tag">'+esc([...g.labels].join(' · '))+'</span><h2>'+esc(g.title)+'</h2><div class="meta">'+esc(metrics(g))+' · '+g.sourceUrls.size+' 条作品</div>'+
 '<button class="jump" id="jump">编辑第一镜 ↓</button><div class="block"><h3>观众原话</h3>'+proof.slice(0,2).join('')+(proof.length>2?'<details><summary>再看 '+(proof.length-2)+' 条原话</summary>'+proof.slice(2).join('')+'</details>':'')+
 '<div class="small">'+(g.authorReply?'已收录作者回复':g.replyCount?'已收录观众回复，样本中未见作者回复':'当前样本未收录回复')+'</div></div>'+
 '<div class="block"><h3>关联拍法笔记</h3><div id="chosenNote" class="notehit"></div><details><summary>更换或取消关联</summary><select id="chooseNote" aria-label="选择拍法笔记"></select></details></div>'+
 '<div class="block"><h3>我的选题卡</h3><p class="small">'+route+'</p>'+editor(f)+'<div class="actions"><button id="copy">复制卡片</button><button class="primary" id="save">存入选题夹</button></div></div>';
 function showNote(){const matched=hits.find(h=>h.n.text===f.note);$('chosenNote').innerHTML=f.note?'<b>'+esc(f.noteTitle)+'</b><p>'+esc(f.note)+'</p><span class="small">'+esc(matched?'匹配依据 · '+matched.reason:'手动关联')+'　'+anchor(f.noteUrl,'查看作品')+'</span>':'暂无关联笔记，可从库中手动选择。'}
 const select=$('chooseNote');select.add(new Option('不关联笔记',''));
 const ranked=[...hits.map(h=>h.i),...allNotes().map((_,i)=>i).filter(i=>!hits.some(h=>h.i===i))];
 for(const i of ranked){const n=allNotes()[i];select.add(new Option((hits.some(h=>h.i===i)?'推荐 · ':'')+n.author+' · '+short(n.title,28),String(i)))}
 const idx=allNotes().findIndex(n=>n.text===f.note);select.value=idx<0?'':String(idx);
 select.onchange=()=>{const n=select.value!==''?allNotes()[Number(select.value)]:null;Object.assign(f,{note:n?.text||'',noteTitle:n?.title||'',noteUrl:n?.url||''});showNote()};
 showNote();bindFields($('detail'),f);$('jump').onclick=()=>$('detail').querySelector('[data-field=shot]').focus();
 const makeCard=()=>({key:groupKey(g),fields:{...f},sample:mode==='sample',evidence:g.rows.map(r=>({...r})),date:new Date().toLocaleDateString('zh-CN')});
 $('save').onclick=()=>saveCard(makeCard());$('copy').onclick=()=>copyCard(makeCard());
}
function saveCard(c){
 if(!c.fields.title.trim())return tell('请先写一个选题标题');
 const i=model.cards.findIndex(x=>x.key===c.key);if(i>=0)model.cards[i]={...model.cards[i],...c};else model.cards.unshift(c);
 if(persist()){tell(i>=0?'已更新选题卡':'已存入选题夹');$('savedCount').textContent=model.cards.length;return true}return false
}
async function copyCard(c){
 const f=c.fields;const lines=[f.title,'','第一镜　'+f.shot,'追问　'+f.ask,'','观众原话'];
 for(const r of c.evidence){lines.push('“'+r.text+'”',...r.replies.map(t=>(t.author?'作者回复　':'回复　')+t.text),r.work+' '+(isWeb(r.url)?r.url:''))}
 for(const clip of cardClips(c.key))lines.push('','参考口播 '+spokenTime(clip.s)+' – '+spokenTime(clip.e),clip.t,spokenUrl(clip));
 if(f.note)lines.push('','关联拍法　'+f.noteTitle,f.note,f.noteUrl);
 try{await navigator.clipboard.writeText(lines.join('\n'));tell('选题卡已复制')}catch{tell('浏览器未允许复制，请选中文字复制')}
}
function filterSavedCards(){
 const query=$('cardSearch').value.trim().toLowerCase();
 const status=$('cardFilter').value;
 let visible=0;
 for(const card of $('cards').querySelectorAll('.savedcard')){
  const matchesStatus=!status || status===card.querySelector('[data-status]').value;
  const matchesText=!query || card.dataset.searchText.includes(query) ||
   [...card.querySelectorAll('.spoken p > span')].some(quote=>quote.textContent.toLowerCase().includes(query));
  card.hidden=!(matchesStatus && matchesText);
  if(!card.hidden)visible++;
 }
 $('cardMatches').textContent=query || status ? '显示 '+visible+' / '+model.cards.length+' 张' : '共 '+model.cards.length+' 张';
 $('noCardMatches').hidden=!model.cards.length || visible>0;
}
$('cardSearch').oninput=filterSavedCards;
$('cardFilter').onchange=filterSavedCards;
function drawCards(){
 const box=$('cards');box.replaceChildren();
 if(!model.cards.length){box.innerHTML='<p class="empty">选好话题后点「存入选题夹」，就能在这里继续编辑。</p>';filterSavedCards();return}
 for(const c of model.cards){
  const card=document.createElement('div');card.className='savedcard';const f={...c.fields};
  const words=[f.title];
  for(const row of c.evidence || []){
   words.push(row.text,...(row.replies || []).map(reply=>reply.text));
  }
  card.dataset.searchText=words.join('\n').toLowerCase();
  card.innerHTML='<span class="small">'+(c.sample?'样本选题':'我的评论')+' · '+esc(c.date)+'</span><h3>'+esc(f.title)+'</h3>'+
   (editingCard===c.key?editor(f)+'<details><summary>查看来源与笔记</summary>'+c.evidence.map(evidenceRow).join('')+esc(f.note)+'</details>':'<p>'+esc(f.shot||'待补充第一镜')+'</p>')+
   '<div class="actions"><select data-status aria-label="拍摄状态"><option value="planned">待拍</option><option value="filmed">已拍</option></select><button data-edit>'+(editingCard===c.key?'保存修改':'编辑')+'</button><button data-copy>复制</button></div>';
  const status=card.querySelector('[data-status]');
  status.value=c.status==='filmed'?'filmed':'planned';
  status.onchange=()=>{
   const previous=c.status;
   c.status=status.value;
   if(!persist()){c.status=previous;status.value=previous==='filmed'?'filmed':'planned';return}
   filterSavedCards();
  };
  bindFields(card,f);card.querySelector('[data-edit]').onclick=()=>{if(editingCard===c.key){if(!f.title.trim())return tell('请先写一个选题标题');saveCard({...c,fields:f});drafts.delete(c.key);editingCard=null}else editingCard=c.key;drawCards()};
  card.querySelector('[data-copy]').onclick=()=>copyCard({...c,fields:f});card.dataset.cardKey=c.key;showSpokenClips(card,c);box.append(card)
 }
 filterSavedCards();
}
function drawNotes(){
 const q=$('search').value.trim().toLowerCase();const items=allNotes().filter(n=>(n.title+n.author+n.text).toLowerCase().includes(q));
 $('noteList').innerHTML=items.map(n=>'<div class="notecard"><div class="small">'+esc(n.author)+'</div><h3>'+esc(short(n.title,55))+'</h3><p>'+esc(n.text)+'</p>'+anchor(n.url,'查看参考作品')+'</div>').join('')||'<p class="empty">没有找到匹配的笔记。</p>';
}
window.addEventListener('storage',event=>{
 if(event.key!==pointer||!event.newValue)return;
 try{const updated=JSON.parse(event.newValue);if(['cards','batches','notes'].every(k=>Array.isArray(updated[k]))){model=updated;model.works??=[];render();changeView(tab)}}catch{}
});
function mergeBatch(b){
 const prev=model.batches.find(x=>x.url===b.url);
 if(prev){
  const rows=new Map(prev.rows.map(r=>[r.id,r]));for(const r of b.rows)rows.set(r.id,{...rows.get(r.id),...r});prev.rows=[...rows.values()]
 }else model.batches.push(b);
}
function addBatch(b){
 mergeBatch(b);persist();mode='mine';category='';changeView('work');render(true);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='work')render();changeView(b.dataset.view)});
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.sort;render(true)});
$('answeredTopics').onchange=()=>render(true);
$('dataset').onchange=e=>{mode=e.target.value;category='';render(true)};
$('category').onchange=e=>{category=e.target.value;render(true)};
$('add').onclick=()=>$('inputDialog').showModal();$('addNote').onclick=()=>$('noteDialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('inputForm').onsubmit=e=>{
 e.preventDefault();const rows=[];let parent='';
 for(const line of $('inputRows').value.split(/\n/).map(s=>s.trim()).filter(Boolean)){
  const match=line.match(/^(作者回复|回复)[：:]\s*(.*)/);
  if(match&&(!parent||!match[2]))return tell('请将完整回复写在对应的主评论下面');
  const text=match?match[2]:line;
  const id=JSON.stringify([match?parent:'',text]);
  rows.push({id,text,parent:match?parent:'',author:match?.[1]==='作者回复'});if(!match)parent=id
 }
 if(!rows.length)return tell('请至少粘贴一条评论');
 const url=$('inputUrl').value.trim();
 if(url&&!isWeb(url))return tell('请输入以 https 或 http 开头的作品链接');
 addBatch({name:$('inputName').value.trim(),url:url||'local:'+crypto.randomUUID(),rows:[...new Map(rows.map(r=>[r.id,r])).values()]});
 $('inputDialog').close();e.target.reset();tell('已加入并分析')
};
$('noteForm').onsubmit=e=>{e.preventDefault();model.notes.unshift({title:$('noteTitle').value.trim(),text:$('noteBody').value.trim(),author:'我的笔记',url:''});persist();$('noteDialog').close();e.target.reset();render();drawNotes()};
$('search').oninput=drawNotes;
async function boot(){
 render();initCreatorUI();initSingle();const key=location.hash.slice(1);if(/^quote-[a-f0-9-]{36}$/.test(key)&&globalThis.chrome?.storage?.session){await chooseSpokenClip(key);return}if(key==='saved'||key==='creators')changeView(key);
 if(!key.startsWith('capture-')||!globalThis.chrome?.storage?.session)return;
 const data=(await chrome.storage.session.get(key))[key];if(!data)return;
 if(data.batch)addBatch(data.batch);
 if(data.creators||data.works)changeView('creators');
 if(data.works)scanCreator(null,5,data.works);
 if(data.error){$('notice').hidden=false;$('notice').textContent=data.error}
 await chrome.storage.session.remove(key);history.replaceState(null,'',location.pathname);
}
boot();
