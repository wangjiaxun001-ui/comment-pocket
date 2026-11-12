// These functions are injected into a Douyin page and must be self-contained.
async function readCreatorProfile(limit) {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const profileUrl = location.origin + location.pathname;
  let list;
  for (let i=0; i<24; i++) {
    list = document.querySelector('[data-e2e="user-post-list"]');
    if (list?.querySelector('a[href*="/video/"]')) break;
    await wait(500);
  }
  if (!list?.querySelector('a[href*="/video/"]')) throw Error('主页没有显示作品。请在 Chrome 打开该博主的「作品」页，确认列表已出现，再点插件。');
  const creator = document.querySelector('[data-e2e="user-info"]')?.innerText.trim().split('\n')[0] || document.title.replace(/的抖音.*$/,'');
  const works = new Map();
  for (let pass=0; pass<4 && works.size<limit; pass++) {
    const links=[...list.querySelectorAll('a[href*="/video/"]')];
    for(const link of links){
      const id=link.pathname.match(/^\/video\/(\d+)/)?.[1];
      if(!id || works.has(id))continue;
      const title=link.querySelector('img[alt]')?.alt || link.innerText.trim().split('\n').at(-1);
      const amount=link.querySelector('.author-card-user-video-like')?.innerText.trim().replace(/,/g,'').match(/^(\d+(?:\.\d+)?)(万|亿)?$/);
      const likes=amount?Math.round(Number(amount[1])*({万:1e4,亿:1e8}[amount[2]]||1)):null;
      works.set(id,{url:'https://www.douyin.com/video/'+id,title:title||'抖音作品',creator,profileUrl,likes,comments:null});
      if(works.size>=limit)break;
    }
    if(works.size<limit && links.length){links.at(-1).scrollIntoView({block:'end'});await wait(850)}
  }
  return [...works.values()];
}
async function readWorkPage(expectedId, rounds=0) {
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const getCount=selector=>{
    const label=document.querySelector(selector)?.innerText.trim().replace(/,/g,'');
    const m=label?.match(/^(\d+(?:\.\d+)?)(万|亿)?$/);
    return m?Math.round(Number(m[1])*({万:1e4,亿:1e8}[m[2]]||1)):null
  };
  let detail;
  for(let i=0;i<45;i++){
    detail=document.querySelector('[data-e2e="detail-video-info"][data-e2e-aweme-id="'+expectedId+'"]');
    if(detail)break;await wait(400)
  }
  if(!detail)return {readerError:'没有读到这条作品的详情，请在抖音确认它可见、能播放后重试。'};
  const listSelector='[data-e2e="comment-list"]';
  document.querySelector(listSelector)?.scrollIntoView({block:'center'});
  for(let i=0;i<12&&!document.querySelector(listSelector+' [data-e2e="comment-item"]');i++)await wait(350);
  // Only operate the page's expand-replies controls, never its reply composer.
  const expandable=/^展开\s*\d+\s*条回复$/;
  const expanders=[...document.querySelectorAll(listSelector+' [data-e2e="comment-item"] :is(span,div,button)')]
    .filter(el=>expandable.test(el.innerText.trim())&&![...el.children].some(child=>expandable.test(child.textContent.trim())));
  for (const el of expanders.slice(0,4)) el.click();
  if(expanders.length)await wait(1250);
  const rows=new Map();
  let batch=null;
  function snapshot(){
    try{
      const read=collectDiscussion();
      if(!read.url.endsWith('/'+expectedId))throw Error('作品已切换');
      batch=read;
      for(const row of read.rows)rows.set(row.id,row);
    }catch{/* Report an empty sample if the comment list never loads. */}
  }
  snapshot();
  for(let i=0;i<rounds;i++){
    const items=[...document.querySelectorAll(listSelector+' [data-e2e="comment-item"]')];
    if(!items.length)break;
    items.at(-1).scrollIntoView({block:'end'});
    await wait(650);
    const more=[...document.querySelectorAll(listSelector+' [data-e2e="comment-item"] :is(span,div,button)')]
      .filter(el=>expandable.test(el.innerText.trim())&&![...el.children].some(c=>expandable.test(c.textContent.trim())));
    for(const el of more.slice(-3))el.click();
    await wait(550);
    snapshot();
  }
  if(batch)batch.rows=[...rows.values()];
  const title=document.querySelector('h1')?.innerText || document.title;
  const creator=[...document.querySelectorAll('[data-e2e="user-info"] a[href*="/user/"]')].map(e=>e.innerText.trim()).find(Boolean)||'';
  const poster=document.querySelector('[data-e2e="video-detail"] video[poster]')?.poster || '';
  return {title,creator,poster,likes:getCount('[data-e2e="video-player-digg"]'),comments:getCount('[data-e2e="feed-comment-icon"]'),batch,checked:new Date().toISOString()};
}
