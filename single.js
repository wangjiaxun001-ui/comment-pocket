const singleViews={questions:'反复提问',liked:'高赞评论',answers:'博主回复'};
const shortOrigins=['https://www.iesdouyin.com/*','https://iesdouyin.com/*'];
let currentSingle=null, singleView='questions', singleBusy=false, permissionRetry='';
function questionIntent(text){
 if(!/[?？]|请问|想问|求.{0,6}(教程|链接|推荐|建议)|怎么|怎样|哪[里个款种]|什么|多少|能否|有没有|是不是|吗[啊呀呢…。，！!\s]*$/.test(text))return '';
 const intents=[
  ['个人风格',/适合.{0,5}风格|什么风格.{0,6}适合/],
  ['购买渠道',/哪里买|在哪.{0,3}买|在哪入|求链接|购买链接/],
  ['潮流回归',/回来|回归|回潮|又.{0,4}流行/],
  ['尺码选择',/什么码|多大码|哪个码|怎么选码|穿几码/]
 ];
 return intents.find(([,re])=>re.test(text))?.[0]||'一般提问';
}
function singleEntries(batch){
 const rows=batch.rows.map(r=>({...r,url:batch.url,work:batch.name,replies:[]}));
 const byId=new Map(rows.map(r=>[r.id,r]));
 for(const r of rows)if(r.parent)byId.get(r.parent)?.replies.push(r);
 const asEvidence=r=>r.parent&&byId.has(r.parent)?{...byId.get(r.parent),replies:[r]}:r;
 const ranked=rows.filter(r=>!r.author&&Number.isFinite(r.likes)&&r.likes>0).sort((a,b)=>b.likes-a.likes);
 const liked=ranked.map(r=>({key:'row:'+r.id,title:short(r.text,58),hint:workNumber(r.likes)+' 赞',evidence:[asEvidence(r)]}));
 const answers=rows.filter(r=>r.author&&r.parent&&byId.has(r.parent)).map(r=>({key:'reply:'+r.id,title:short(byId.get(r.parent).text,58),hint:'楼中楼 · 博主回复',evidence:[asEvidence(r)]}));
 const clusters=[];
 for(const r of rows){
   const intent=questionIntent(r.text);
   if(!intent||r.author)continue;
   const terms=words(r.text);
   let c=clusters.find(c=>{
     if(c.intent!==intent)return false;
     if(c.text===r.text)return true;
     if(intent!=='一般提问')return true;
     const overlap=tokensOverlap(c.terms,terms);
     return overlap>=2&&overlap/Math.max(1,Math.max(c.terms.size,terms.size))>=.5
   });
   if(!c){c={intent,terms,text:r.text,rows:[]};clusters.push(c)}
   c.rows.push(r)
 }
 const questions=clusters.map(c=>{
   const count=new Set(c.rows.map(r=>r.who).filter(Boolean)).size;
   return {count,key:'question:'+c.intent+':'+c.rows[0].id,title:short(c.text,58),hint:count+' 位可识别观众发问 · '+c.rows.length+' 条提问',evidence:c.rows.map(asEvidence)}
 }).filter(c=>c.count>=2).sort((a,b)=>b.count-a.count);
 return {questions,liked,answers};
}
function oneClickSave(item,button){
 const info=currentSingle;
 // Use the underlying viewer comments as provenance, including the actual reply when present.
 const roots=item.evidence;
 const group=analyze([{...info.batch,rows:roots.map(r=>({...r,parent:''}))}])[0];
 if(!group)return;
 const fields=initialDraft(group);
 if(!group.rule)fields.title=item.title;
 const key='single:'+info.url+'#'+item.key;
 if(model.cards.some(c=>c.key===key)){changeView('saved');return}
 const card={key,fields,evidence:roots,sample:false,date:new Date().toLocaleDateString('zh-CN')};
 if(saveCard(card))button.textContent='已保存 · 查看'
}
function resultCard(item){
 const el=document.createElement('div');el.className='single-card';
 const saved=model.cards.some(c=>c.key==='single:'+currentSingle.url+'#'+item.key);
 el.innerHTML='<span class="small">'+esc(item.hint)+'</span><div class="single-card-heading"><h3>'+esc(item.title)+'</h3><button>'+ (saved?'已保存 · 查看':'存为选题卡')+'</button></div>';
 const evidence=item.evidence.map(evidenceRow);
 el.insertAdjacentHTML('beforeend',evidence.slice(0,2).join(''));
 if(evidence.length>2)el.insertAdjacentHTML('beforeend','<details><summary>另 '+(evidence.length-2)+' 条原话</summary>'+evidence.slice(2).join('')+'</details>');
 const btn=el.querySelector('button');btn.onclick=()=>oneClickSave(item,btn);return el
}
function drawSingle(){
 const data=currentSingle;
 $('singleResult').hidden=!data;
 if(!data)return;
 $('singleName').textContent=data.title||data.batch.name;
 const roots=data.batch.rows.filter(r=>!r.parent).length;
 $('singleMeta').textContent=[data.creator,'已收录 '+roots+' 条主评、'+(data.batch.rows.length-roots)+' 条回复',Number.isFinite(data.comments)?'页面评论数 '+workNumber(data.comments):''].filter(Boolean).join(' · ');
 $('singleSource').href=data.url;
 const cover=$('singleCover');cover.hidden=true;cover.onload=()=>{cover.hidden=false};cover.onerror=()=>{cover.hidden=true};
 if(/^https:\/\//.test(data.poster||'')){if(cover.getAttribute('src')!==data.poster)cover.src=data.poster;else cover.hidden=!cover.naturalWidth}else cover.removeAttribute('src');
 const entries=singleEntries(data.batch);
 const tabs=$('singleTabs');tabs.replaceChildren();
 for(const [k,label] of Object.entries(singleViews)){
   const b=document.createElement('button');b.textContent=label+' '+entries[k].length;b.setAttribute('aria-pressed',k===singleView);b.onclick=()=>{singleView=k;drawSingle()};tabs.append(b)
 }
 const list=$('singleItems');list.replaceChildren();
 for(const item of entries[singleView])list.append(resultCard(item));
 if(!list.children.length){
   const empty=document.createElement('p');empty.className='empty';
   empty.textContent={questions:'已读样本中，尚未发现至少两位观众反复问同一件事。',liked:'已读样本中，还没有带正点赞数的观众留言。',answers:'已读样本中，暂未读到带作者标记的回复。'}[singleView];list.append(empty)
 }
 $('singleMore').disabled=singleBusy||data.rounds>=5;
}
async function analyzeSingle(more=false){
 if(singleBusy)return;
 let link;
 try{link=parseVideoLink(more?currentSingle.url:$('singleInput').value)}catch(e){$('singleStatus').textContent=e.message;return}
 if(!canScan()){
   // The installed extension and file preview have different origins. Transfer only the normalized public URL.
   const handoff='chrome-extension://bbnlnmgaegfahkbhamcjglibackpndnd/index.html#video='+encodeURIComponent(link.url);
   $('singleStatus').innerHTML='实时读取使用已安装的 Chrome 插件。 <a href="'+esc(handoff)+'" target="_blank" rel="noreferrer">带着这条链接打开插件 →</a> <button type="button" id="copyEntry">复制插件入口</button>';
   $('copyEntry').onclick=async()=>{try{await navigator.clipboard.writeText(handoff);tell('已复制，请粘贴到 Chrome 地址栏')}catch{prompt('复制并在 Chrome 打开',handoff)}};
   return
 }
 singleBusy=true;$('singleSubmit').disabled=true;$('singleMore').disabled=true;
 if(!more){currentSingle=null;drawSingle()}
 $('singleStatus').textContent=link.short?'正在识别分享短链…':'正在读取作品与评论…';
 try{
   if(link.short&&permissionRetry===link.url&&!await chrome.permissions.request({origins:shortOrigins}))throw Error('读取分享跳转页需要你的允许，也可以直接粘贴展开后的抖音作品地址。');
   const rounds=more?Math.min(5,currentSingle.rounds+2):1;
   const res=await requestScan({op:'single',url:link.url,rounds});
   const fresh=res.batch||{name:res.title||'抖音作品',url:res.url,rows:[]};
   const prev=more?currentSingle.batch.rows:[];
   const map=new Map([...prev,...fresh.rows].map(r=>[r.id,r]));
   const batch={...fresh,rows:[...map.values()]};
   if(fresh.rows.length){mergeBatch(fresh);persist()}
   currentSingle={...res,batch,rounds};const count=batch.rows.length-prev.length;
   if(!more){const views=singleEntries(batch);singleView=views.questions.length?'questions':views.liked.length?'liked':views.answers.length?'answers':'questions'}
   $('singleStatus').textContent=!batch.rows.length?'作品已识别，目前没有读到评论。可继续读取，或先在抖音网页确认评论可见。':more?(count?'本次新增 '+count+' 条留言。':'本次未读到更多留言。'):'读取完成。';
 }catch(e){
   if(e.message==='SHORT_ACCESS'){
     permissionRetry=link.url;
     $('singleStatus').textContent='短链可能跳转到抖音分享域名。再点一次「分析这条视频」可授权识别该跳转，也可以粘贴展开后的作品地址。';
   }else $('singleStatus').textContent=e.message
 }
 finally{singleBusy=false;$('singleSubmit').disabled=false;drawSingle()}
}
function initSingle(){
 const preset=new URLSearchParams(location.hash.slice(1)).get('video');
 if(preset){try{$('singleInput').value=parseVideoLink(preset).url}catch{}}
 $('singleHelp').textContent=canScan()?'从网页实际加载的评论中分析，可继续读取更多。':'实时分析会转到已安装的 Chrome 插件。';
 $('singleForm').onsubmit=e=>{e.preventDefault();analyzeSingle()};
 $('singleMore').onclick=()=>analyzeSingle(true)
}
