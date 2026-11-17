/* Only the paired, locally installed 拾句 extension can offer a quote.
   A message only opens a chooser; writing a card still needs a user click. */
chrome.runtime.onMessageExternal.addListener((m,sender,reply)=>{
 if(sender.id!=='kjgekajeeapmboeanokamomecbnpalah'||m?.op!=='offer-spoken-clip')return;
 (async()=>{
  const clip=cleanSpokenClip(m.clip);
  if(!clip)throw Error('口播片段缺少有效的作品或时间。');
  const key='quote-'+crypto.randomUUID();
  await chrome.storage.session.set({[key]:clip});
  try{await chrome.tabs.create({url:chrome.runtime.getURL('index.html#'+key)})}
  catch(e){await chrome.storage.session.remove(key);throw e}
  return {ok:true}
 })().then(reply,e=>reply({error:e.message}));return true
});
