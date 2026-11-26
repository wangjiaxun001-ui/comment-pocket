// Plain text shared by clipboard copying and TXT export. No browser storage access.
(function () {
 const text=value=>typeof value==='string'?value.trim():'';
 const list=value=>Array.isArray(value)?value:[];
 function webUrl(value){
  const source=text(value);
  if(!/^https?:\/\//i.test(source))return '';
  try{const url=new URL(source);return url.hostname?source:''}catch{return ''}
 }
 const time=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
 function formatTopicCard(card,clips=[]){
  const fields=card?.fields||{},parts=[];
  const title=text(fields.title);if(title)parts.push(title);
  if(text(fields.idea))parts.push('我的写作思路\n'+text(fields.idea));
  if(text(fields.shot))parts.push('第一镜　'+text(fields.shot));
  if(text(fields.ask))parts.push('追问　'+text(fields.ask));
  const evidence=[];
  for(const row of list(card?.evidence)){
   if(!row||typeof row!=='object')continue;
   const lines=[];
   if(text(row.text))lines.push('“'+text(row.text)+'”');
   for(const reply of list(row.replies))if(text(reply?.text))lines.push((reply.author?'作者回复　':'回复　')+text(reply.text));
   if(!lines.length)continue;
   if(text(row.work))lines.push('作品　'+text(row.work));
   if(webUrl(row.url))lines.push(webUrl(row.url));
   evidence.push(lines.join('\n'));
  }
  if(evidence.length)parts.push('观众原话\n'+evidence.join('\n\n'));
  for(const clip of list(clips)){
   if(!text(clip?.t))continue;
   const validTime=Number.isFinite(clip.s)&&Number.isFinite(clip.e)&&clip.s>=0&&clip.e>clip.s&&clip.e<=86400;
   const lines=['参考口播'+(validTime?' '+time(clip.s)+' 至 '+time(clip.e):''),text(clip.t)];
   if(text(clip.note))lines.push('参考点　'+text(clip.note));
   if(text(clip.title))lines.push('作品　'+text(clip.title));
   if(typeof clip.id==='string'&&/^\d{10,22}$/.test(clip.id))lines.push('https://www.douyin.com/video/'+clip.id);
   parts.push(lines.join('\n'));
  }
  const note=[text(fields.noteTitle),text(fields.note),webUrl(fields.noteUrl)].filter(Boolean);
  if(note.length)parts.push('关联拍法\n'+note.join('\n'));
  return parts.join('\n\n');
 }
 function formatTopicCards(cards,getClips=()=>[]){
  const exported=[];
  for(const card of list(cards)){
   const body=formatTopicCard(card,typeof getClips==='function'?getClips(card?.key):[]);
   if(body)exported.push('【选题 '+(exported.length+1)+'】\n'+body);
  }
  return exported.join('\n\n════════════════════\n\n');
 }
 globalThis.formatTopicCard=formatTopicCard;
 globalThis.formatTopicCards=formatTopicCards;
})();
