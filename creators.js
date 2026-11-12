let scanning=false,stopRequested=false;
const canScan=()=>location.protocol==='chrome-extension:'&&!!globalThis.chrome?.runtime?.sendMessage;
const workNumber=n=>Number.isFinite(n)?n.toLocaleString('zh-CN'):'未读取';
function numInput(id){
 const text=$(id).value.trim();return text===''?null:Math.max(0,Number(text))
}
function threadsFor(work,source){
 const batches=source==='live'?model.batches:samples;
 const rows=batches.find(b=>b.url===work.url)?.rows||[];
 const replies=new Map();
 for(const row of rows)if(row.parent){
   if(!replies.has(row.parent))replies.set(row.parent,[]);
   replies.get(row.parent).push(row)
 }
 return rows.filter(row=>!row.parent).map(root=>({root,replies:replies.get(root.id)||[]}));
}
function selectWorks(works,filters){
 return works.filter(w=>{
   if(filters.creator&&w.creator!==filters.creator)return false;
   if(filters.likes!==null&&(!Number.isFinite(w.likes)||w.likes<filters.likes))return false;
   if(filters.min!==null&&(!Number.isFinite(w.comments)||w.comments<filters.min))return false;
   if(filters.target!==null&&(!Number.isFinite(w.comments)||Math.abs(w.comments-filters.target)>filters.target*filters.tolerance))return false;
   return !filters.author||w.hasReply;
 }).sort((a,b)=>(b[filters.order]??-1)-(a[filters.order]??-1)||(b.likes??-1)-(a.likes??-1))
}
function drawWorks(){
 const source=$('workSource').value;
 const raw=source==='live'?(model.works||[]):exampleWorks;
 const names=[...new Set(raw.map(w=>w.creator))].sort((a,b)=>a.localeCompare(b,'zh'));
 const choose=$('creatorFilter'),previous=choose.value;choose.replaceChildren(new Option('全部博主',''));
 for(const name of names)choose.add(new Option(name,name));
 choose.value=names.includes(previous)?previous:'';
 const filters={creator:choose.value,order:$('worksOrder').value,likes:numInput('likesMin'),min:numInput('commentsMin'),target:numInput('commentsTarget'),tolerance:Number($('tolerance').value),author:$('creatorOnly').checked};
 const listed=raw.map(w=>{
    const threads=threadsFor(w,source);
    return {...w,threads,hasReply:threads.some(t=>t.replies.some(r=>r.author))}
 });
 const matched=selectWorks(listed,filters);
 $('matches').textContent=matched.length+' / '+raw.length+' 条作品';
 $('metricHint').textContent=filters.target===null?'互动数字按页面或示例记录值展示':'评论范围 '+Math.ceil(filters.target*(1-filters.tolerance)-1e-8)+' – '+Math.floor(filters.target*(1+filters.tolerance)+1e-8);
 const box=$('workResults');box.replaceChildren();
 if(!matched.length){box.innerHTML='<p class="empty">'+(raw.length?'当前条件下没有匹配作品。':'还没有获取作品。可先切换到「示例作品快照」体验筛选。')+'</p>';return}
 for(const w of matched)box.append(workRow(w,source));
}
function discussionDetails(threads,authorOnly){
 const list=threads.filter(t=>!authorOnly||t.replies.some(r=>r.author)).sort((a,b)=>(b.root.likes??-1)-(a.root.likes??-1));
 if(!list.length)return '<p class="small">本次未读到匹配的评论。</p>';
 return list.map(({root,replies})=>'<blockquote>'+esc(root.text)+(Number.isFinite(root.likes)?' <small>· '+workNumber(root.likes)+' 赞</small>':'')+
 replies.filter(r=>!authorOnly||r.author).map(r=>'<p><b>'+(r.author?'博主回复':'观众回复')+'</b>　'+esc(r.text)+'</p>').join('')+'</blockquote>').join('')
}
function workRow(w,source){
 const el=document.createElement('section');el.className='workrow';
 const count=w.threads.reduce((n,t)=>n+t.replies.filter(r=>r.author).length,0);
 const authorOnly=$('creatorOnly').checked;
 el.innerHTML='<span class="small">'+esc(w.creator)+'</span><h3>'+anchor(w.url,w.title)+'</h3><div class="meta">点赞 '+workNumber(w.likes)+'　·　评论 '+workNumber(w.comments)+'　·　已读博主回复 '+count+' 条</div>'+
 (w.error?'<p class="statewarn small">'+esc(w.error)+'</p>':'')+
 '<div class="workbuttons"></div>';
 const buttons=el.querySelector('.workbuttons');
 if(Number.isFinite(w.comments)){
   const similar=document.createElement('button');similar.textContent='找评论量相近的作品';similar.onclick=()=>{$('commentsTarget').value=w.comments;$('worksOrder').value='likes';drawWorks()};buttons.append(similar)
 }
 if(canScan()){
   const retry=document.createElement('button');retry.textContent='获取这条作品的评论与回复';retry.disabled=scanning;retry.onclick=()=>scanCreator(null,1,[{url:w.url,title:w.title,creator:w.creator,likes:source==='live'?w.likes:null,comments:source==='live'?w.comments:null}]);buttons.append(retry)
 }
 if(w.threads.length){
   const detail=document.createElement('details');
   detail.open=authorOnly;detail.innerHTML='<summary>'+(authorOnly?'查看博主回复':'查看已读评论 · 有赞数的优先显示')+'</summary>'+discussionDetails(w.threads,authorOnly);el.append(detail)
 }
 return el
}
function setWorkStatus(text){$('scanState').hidden=false;$('scanState').textContent=text}
function clearWorkFilters(){
 for(const id of ['creatorFilter','likesMin','commentsMin','commentsTarget'])$(id).value='';
 $('tolerance').value='.2';$('creatorOnly').checked=false;$('worksOrder').value='comments';
}
async function requestScan(message){
 const answer=await chrome.runtime.sendMessage(message);
 if(!answer||answer.error)throw Error(answer?.error||'读取中断，请刷新插件重试');
 return answer.data
}
function mergeWork(work){
 const old=model.works.find(w=>w.url===work.url);
 if(!old){model.works.push({...work});return}
 for(const [k,v] of Object.entries(work))if(v!=null)old[k]=v;
}
async function scanCreator(url,limit,provided){
 if(scanning)return;
 if(!canScan()){setWorkStatus('实时获取需用 Chrome 插件。加载 comment-pocket 文件夹后，在博主主页点工具栏里的「评论区选题夹」。');return}
 scanning=true;stopRequested=false;$('scanStart').disabled=true;$('stopScan').hidden=false;
 let done=0,fail=0;
 try{
  setWorkStatus('正在读取博主作品列表…');
  const works=provided||await requestScan({op:'profile',url,limit});
  if(!works.length)throw Error('这个主页没有读到作品。');
  $('workSource').value='live';clearWorkFilters();
  for(const w of works)mergeWork({url:w.url,title:w.title,creator:w.creator,profileUrl:w.profileUrl,likes:w.likes,comments:w.comments});
  persist();drawWorks();$('creatorFilter').value=works[0].creator;drawWorks();
  for(const w of works){
    if(stopRequested)break;
    setWorkStatus('正在读取 '+(done+fail+1)+' / '+works.length+' · '+short(w.title,32));
    try{
      const data=await requestScan({op:'work',url:w.url});
      if(data.batch)mergeBatch(data.batch);
      mergeWork({url:w.url,likes:data.likes,comments:data.comments,checked:data.checked,error:''});
      done++
    }catch(e){mergeWork({url:w.url,error:'本次未能更新：'+e.message});fail++}
    persist();drawWorks()
  }
  setWorkStatus((stopRequested?'已停止。':'读取完毕。')+'取得 '+works.length+' 条作品链接，已查看 '+done+' 条详情，'+fail+' 条读取失败。'+(done?' 已取得的留言也可在「选题工作台 → 我的评论」查看。':''))
 }catch(e){setWorkStatus(e.message)}finally{scanning=false;$('scanStart').disabled=false;$('stopScan').hidden=true;drawWorks();render()}
}
function initCreatorUI(){
 $('workSource').value=model.works?.length?'live':'sample';
 $('scanHelp').textContent=canScan()?'在本机 Chrome 逐条打开并关闭临时作品页。读取范围为页面可见的主评和本轮展开的回复。':'当前是网页预览，可筛选示例作品。实时收取请在 Chrome 安装本文件夹里的插件，进入博主主页点插件图标。';
 $('scanForm').onsubmit=e=>{e.preventDefault();scanCreator($('profileUrl').value.trim(),Number($('scanSize').value))};
 $('stopScan').onclick=()=>{stopRequested=true;setWorkStatus('当前页面读完后停止。')};
 for(const id of ['workSource','creatorFilter','worksOrder','tolerance','creatorOnly'])$(id).onchange=drawWorks;
 for(const id of ['likesMin','commentsMin','commentsTarget'])$(id).oninput=drawWorks;
 $('clearFilters').onclick=()=>{clearWorkFilters();drawWorks()};
}
