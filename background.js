importScripts('collect.js','creator-reader.js','video-link.js','clip-data.js','clips-worker.js');
function creatorUrl(input){
  const parsed=new URL(input);
  if(parsed.origin!=='https://www.douyin.com'||!/^\/user\/[\w-]+\/?$/.test(parsed.pathname))throw Error('请输入抖音网页版博主主页链接（www.douyin.com/user/…）。');
  return parsed.origin+parsed.pathname
}
async function inject(id,func,args=[]){
  const [value]=await chrome.scripting.executeScript({target:{tabId:id},func,args});
  if(value?.error || value?.result==null)throw Error(value?.error?.message||'页面没有返回数据，请在网页加载后重试。');
  if(value.result.readerError)throw Error(value.result.readerError);
  return value.result
}
async function ownedTab(url,read){
  const tab=await chrome.tabs.create({url:'about:blank',active:false});
  let timeout;
  try{
    await chrome.tabs.update(tab.id,{muted:true});
    await chrome.tabs.update(tab.id,{url});
    for(let i=0;i<80;i++){
      const t=await chrome.tabs.get(tab.id);
      if(t.url===url && t.status==='complete')break;
      if(t.url===url && i>12)break;
      await new Promise(resolve=>setTimeout(resolve,200))
    }
    return await Promise.race([read(tab.id),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('页面读取超时，可稍后重试')),40000)})])
  }finally{clearTimeout(timeout);await chrome.tabs.remove(tab.id).catch(()=>{})}
}
async function singleWork(input,rounds){
  const link=parseVideoLink(input);
  if(!link.short)return {url:link.url,...await fetchWork(link.url,rounds)};
  const tab=await chrome.tabs.create({url:'about:blank',active:false});
  try{
    await chrome.tabs.update(tab.id,{muted:true});
    await chrome.tabs.update(tab.id,{url:link.url});
    let workUrl='';
    for(let i=0;i<100;i++){
      const current=await chrome.tabs.get(tab.id);
      let resolved;
      try{resolved=parseVideoLink(current.url||'')}catch{}
      if(resolved&&!resolved.short){
        workUrl=resolved.url;
        if(new URL(current.url).origin!=='https://www.douyin.com'){
          await chrome.tabs.update(tab.id,{url:workUrl});
        }else if(current.status==='complete'){
          return {url:workUrl,...await readTabWork(tab.id,workUrl,rounds)};
        }
      }
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(workUrl)return {url:workUrl,...await fetchWork(workUrl,rounds)};
    if(!await chrome.permissions.contains({origins:['https://www.iesdouyin.com/*','https://iesdouyin.com/*']}))throw Error('SHORT_ACCESS');
    throw Error('短链未跳转到视频，可能已过期。请在抖音确认作品可见后复制视频页地址。');
  }finally{await chrome.tabs.remove(tab.id).catch(()=>{})}
}
async function readTabWork(id,url,rounds){
  await chrome.scripting.executeScript({target:{tabId:id},files:['collect.js']});
  return inject(id,readWorkPage,[url.split('/').at(-1),rounds])
}
async function profile(url,limit){
  return ownedTab(creatorUrl(url),id=>inject(id,readCreatorProfile,[limit]))
}
async function fetchWork(url,rounds=0){
  const match=url.match(/^https:\/\/www\.douyin\.com\/video\/(\d+)$/);
  if(!match)throw Error('作品链接无效');
  return ownedTab(url,id=>readTabWork(id,url,rounds))
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.url?.split(/[?#]/)[0]!==chrome.runtime.getURL('index.html'))return;
  const limit=[3,5,10,20].includes(m.limit)?m.limit:5;
  if(m.op==='single'){
    (async()=>{
      const rounds=Math.min(5,Math.max(0,Number(m.rounds)||0));
      return singleWork(m.url,rounds)
    })().then(data=>reply({data}),e=>reply({error:e.message}));
    return true;
  }
  const task=m.op==='profile'?()=>profile(m.url,limit):m.op==='work'?()=>fetchWork(m.url):null;
  if(!task)return;
  Promise.resolve().then(task).then(data=>reply({data}),e=>reply({error:e.message}));return true
});
chrome.action.onClicked.addListener(async tab=>{
  let payload={};
  try{
    const url=new URL(tab.url);
    if(url.hostname==='www.douyin.com'&&url.pathname.startsWith('/user/')&&!url.searchParams.has('modal_id')){
      payload.works=await inject(tab.id,readCreatorProfile,[5]);
    }else if(/(^|\.)douyin\.com$/.test(url.hostname)){
      payload.batch=await inject(tab.id,collectDiscussion);
    }else{payload.home=true}
  }catch(e){payload.error=e.message;payload.creators=true}
  const key='capture-'+crypto.randomUUID();
  await chrome.storage.session.set({[key]:payload});
  await chrome.tabs.create({url:chrome.runtime.getURL('index.html')+'#'+key});
});
