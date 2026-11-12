// Executed in the current work's isolated world after a toolbar click.
function collectDiscussion() {
  const url = new URL(location.href);
  const workId = url.searchParams.get('modal_id') || url.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!workId || !/^\d+$/.test(workId)) throw Error('请先打开一条抖音作品。');
  const source = 'https://www.douyin.com/video/' + workId;
  const items = [...document.querySelectorAll('[data-e2e="comment-list"] [data-e2e="comment-item"]')];
  const rows = [];
  const seen = new Set();
  function identity(text) {
    // A source-scoped alias is sufficient for per-work participation counts.
    let h = 2166136261;
    for (const ch of source + text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return (h >>> 0).toString(36);
  }
  for (const item of items) {
    // Replies can themselves carry data-e2e="comment-item". Walk the top-level thread once.
    if (item.parentElement.closest('[data-e2e="comment-item"]') || !item.getClientRects().length) continue;
    const bodies = [...item.querySelectorAll('.FduGc_lz')];
    let root = '';
    for (const body of bodies) {
      const text = body.innerText.trim();
      if (!text) continue;
      const link = body.parentElement.querySelector('a[href*="/user/"]');
      const who = link ? identity(link.pathname || link.innerText) : '';
      const author = link?.innerText.split(/\s+/).includes('作者') || false;
      const key = identity([root,who,text].join('|'));
      const panel=body.parentElement.innerText;
      const count=panel.replace(/,/g,'').match(/(?:^|\n)\s*(\d+(?:\.\d+)?)(万|亿)?\s*\n\s*分享\s*\n\s*回复/);
      const likes=count?Math.round(Number(count[1])*({万:1e4,亿:1e8}[count[2]]||1)):null;
      if (!seen.has(key)) rows.push({id:key, parent:root, text, who, author, likes});
      seen.add(key);
      if (!root) root = key;
    }
  }
  if (!rows.length) throw Error('还没有读到评论。请打开单条作品的评论区，等留言显示后再点插件，也可以在工作台粘贴评论。');
  return {name:document.querySelector('h1')?.innerText || document.title, url:source, rows};
}
