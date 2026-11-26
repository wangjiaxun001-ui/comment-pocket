// Isolated browser test with sample data; never reads the user's browser profile.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:980}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost/**',route=>{
   const name=path.basename(new URL(route.request().url()).pathname),file=path.join(__dirname,'..',name);
   return fs.existsSync(file)?route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)}):route.fulfill({status:404,body:''});
  });
  await page.addInitScript(()=>{
   const key='bandiaopai-pocket-v1';
   if(!localStorage.getItem(key)){
    localStorage.setItem(key,JSON.stringify({cards:[
     {key:'a',fields:{title:'宽松裤脚如何搭鞋',shot:'先拍鞋和裤脚的侧面',ask:'你会怎么选',note:'比较轮廓比例',noteTitle:'比例笔记'},evidence:[{text:'小个子也适合吗',work:'鞋裤搭配示范',url:'https://www.douyin.com/video/7701656133378788644',replies:[]}],date:'2026/11/25'},
     {key:'b',fields:{title:'牛仔外套穿搭',shot:'同机位比较',ask:''},evidence:[],status:'filmed',date:'2026/11/25'}
    ],notes:[],batches:[],works:[]}));
    localStorage.setItem('pocket-spoken-v1:'+JSON.stringify(['a','7701656133378788644',12000,18000]),JSON.stringify({id:'7701656133378788644',s:12,e:18,t:'先让裤脚落在鞋面上',title:'参考视频示例',note:'用近景解释鞋裤关系'}));
   }
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text}}});
  });
  await page.goto('http://localhost/index.html#saved');
  const cards=page.locator('.savedcard'),card=key=>page.locator(`[data-card-key="${key}"]`);
  assert.equal(await cards.count(),2);
  // New ideas do not need a collected comment, and whitespace cannot create an empty card.
  await page.locator('#newCard').click();await page.locator('#newCardTitle').fill('   ');
  await page.locator('#newCardForm button.primary').click();assert.equal(await cards.count(),2);
  await page.locator('#newCardTitle').fill('同一条牛仔裤，穿出三种感觉');
  await page.locator('#newCardIdea').fill('先给结论，再拆解三个搭配。\n借鉴博主对比鞋型的讲法。');
  await page.locator('#newCardShot').fill('同一机位连切三套搭配');
  await page.locator('#newCardForm button.primary').click();assert.equal(await cards.count(),3);
  const key=await cards.first().getAttribute('data-card-key');
  await card('a').locator('[data-pin]').click();assert.equal(await cards.first().getAttribute('data-card-key'),'a');
  await page.locator('#pinnedOnly').check();assert.equal(await page.locator('.savedcard:visible').count(),1);
  await page.locator('#cardFilter').selectOption('filmed');assert.equal(await page.locator('.savedcard:visible').count(),0);
  await page.locator('#clearCardFilters').click();assert.equal(await page.locator('.savedcard:visible').count(),3);
  // Search includes notes, shot, multi-word reference, source title and manual ideas.
  for(const q of ['轮廓比例','裤脚 侧面','近景 鞋裤','参考视频示例','鞋裤搭配示范']){
   await page.locator('#cardSearch').fill(q);assert.equal(await page.locator('.savedcard:visible').count(),1,q);
   assert.equal(await card('a').isVisible(),true,q);
  }
  await page.locator('#cardSearch').fill('三个搭配');assert.equal(await card(key).isVisible(),true);
  await page.locator('#clearCardFilters').click();
  // In-page navigation and pin/status changes retain unsaved editor text.
  await card(key).locator('[data-edit]').click();await card(key).locator('[data-field=idea]').fill('改成四套搭配，先拍全身再拍细节');
  await page.locator('[data-view=notes]').click();await page.locator('[data-view=saved]').click();
  assert.equal(await card(key).locator('[data-field=idea]').inputValue(),'改成四套搭配，先拍全身再拍细节');
  await card('a').locator('[data-edit]').click();await card('a').locator('[data-field=ask]').fill('修改中的追问');
  await card(key).locator('[data-edit]').click();
  assert.equal(await card(key).locator('[data-field=idea]').inputValue(),'改成四套搭配，先拍全身再拍细节');
  await card(key).locator('[data-pin]').click();await card(key).locator('[data-status]').selectOption('filmed');
  // A full storage quota must keep the edit open and keep the old saved version.
  await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('full')}});
  await card(key).locator('[data-edit]').click();assert.equal(await card(key).locator('[data-field=idea]').isVisible(),true);
  assert.match(await page.evaluate(k=>JSON.parse(localStorage.getItem('bandiaopai-pocket-v1')).cards.find(c=>c.key===k).fields.idea,key),/三个搭配/);
  await page.evaluate(()=>{Storage.prototype.setItem=window.realSet});
  await card(key).locator('[data-edit]').click();
  await card(key).locator('[data-copy]').click();assert.match(await page.evaluate(()=>copied),/四套搭配/);
  await card('a').locator('[data-edit]').click();assert.equal(await card('a').locator('[data-field=ask]').inputValue(),'修改中的追问');
  await card('a').locator('[data-edit]').click();
  await page.reload();await page.locator('[data-view=saved]').click();
  assert.equal(await cards.count(),3);assert.equal(await card(key).locator('[data-pin]').getAttribute('aria-pressed'),'true');
  assert.equal(await card(key).locator('[data-status]').inputValue(),'filmed');
  assert.match(await card(key).innerText(),/四套搭配/);assert.match(await card('a').innerText(),/裤脚落在鞋面/);
  await card('a').locator('[data-copy]').click();assert.match(await page.evaluate(()=>copied),/近景解释鞋裤关系/);
  await card(key).locator('[data-pin]').click();assert.equal(await card(key).locator('[data-pin]').getAttribute('aria-pressed'),'false');
  // Archive saves the in-progress draft and retains sources, pin, status and clips.
  await card('a').locator('[data-edit]').click();await card('a').locator('[data-field=idea]').fill('先解释裤脚，再展示鞋型');
  await card('a').locator('[data-archive]').click();assert.equal(await card('a').isVisible(),false);
  assert.equal(await page.locator('.savedcard:visible').count(),2);
  await page.reload();await page.locator('[data-view=saved]').click();assert.equal(await card('a').isVisible(),false);
  await page.locator('#cardShelf').selectOption('archived');assert.equal(await card('a').isVisible(),true);
  assert.match(await card('a').innerText(),/先解释裤脚/);assert.match(await card('a').innerText(),/裤脚落在鞋面/);
  await page.locator('#copyVisibleCards').click();
  const archivedCopy=await page.evaluate(()=>copied);assert.match(archivedCopy,/参考点/);assert.doesNotMatch(archivedCopy,/牛仔外套穿搭/);
  await card('a').locator('[data-archive]').click();assert.equal(await card('a').isVisible(),false);
  assert.equal(await page.locator('#downloadVisibleCards').isDisabled(),true);
  await page.locator('#cardShelf').selectOption('active');assert.equal(await cards.first().getAttribute('data-card-key'),'a');
  assert.equal(await card('a').locator('[data-pin]').getAttribute('aria-pressed'),'true');
  // Failed archive must not hide the card or discard the user's text.
  await card('a').locator('[data-edit]').click();await card('a').locator('[data-field=idea]').fill('保留未保存的导出修改');
  await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('full')}});
  await card('a').locator('[data-archive]').click();assert.equal(await card('a').isVisible(),true);
  assert.equal(await card('a').locator('[data-field=idea]').inputValue(),'保留未保存的导出修改');
  await page.evaluate(()=>{Storage.prototype.setItem=window.realSet});
  // Export follows the combined filter and includes the latest draft without changing storage.
  await page.locator('#pinnedOnly').check();await page.locator('#cardFilter').selectOption('planned');
  await page.locator('#cardSearch').fill('裤脚');
  await page.locator('#copyVisibleCards').click();const exported=await page.evaluate(()=>copied);
  assert.match(exported,/保留未保存的导出修改/);assert.match(exported,/https:\/\/www.douyin.com\/video\/7701656133378788644/);
  assert.doesNotMatch(exported,/牛仔外套穿搭|同一条牛仔裤/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bandiaopai-pocket-v1')).cards.find(c=>c.key==='a').fields.idea),'先解释裤脚，再展示鞋型');
  const downloadEvent=page.waitForEvent('download');await page.locator('#downloadVisibleCards').click();
  const download=await downloadEvent;assert.match(download.suggestedFilename(),/1张\.txt$/);
  const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'').trim(),exported.trim());
  await page.locator('#cardSearch').fill('没有这个关键词');assert.equal(await page.locator('#copyVisibleCards').isDisabled(),true);
  await page.locator('#clearCardFilters').click();await card('a').locator('[data-edit]').click();
  await page.reload();await page.locator('[data-view=saved]').click();
  assert.equal(await page.locator('.savedcard:visible').count(),3);assert.match(await card('a').innerText(),/保留未保存的导出修改/);
  assert.deepEqual(errors,[]);
  if(process.env.SCREENSHOT)await page.screenshot({path:process.env.SCREENSHOT,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#newCard').click();assert.equal(await page.locator('#newCardTitle').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS new idea, whitespace rejection, pin/filter, full-text search, edit retention, failed-save recovery, copy, refresh, old clips mobile layout, archive/restore, filtered copy and TXT download');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
