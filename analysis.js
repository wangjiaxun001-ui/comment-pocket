const angleRules = [
  {id:'narrow',match:/小脚裤|铅笔裤|紧身裤|束腿牛仔裤|amiri|高街.{0,6}(回来|崛起)|身材已不允许/i,
   title:'小脚裤又回来了，到底窄在哪？',subject:'小脚裤',type:'观点讨论',ease:3,tags:['裤脚','肩线','窄身','裤子'],
   shot:'同一个人穿直筒和窄脚两条裤子，机位对齐膝盖和鞋面，先让观众挑。',ask:'你介意的是小腿贴身，还是裤脚盖住鞋面的样子？'},
  {id:'fabric',match:/厚毛呢|垂感|面料.{0,6}(软|硬|挺|塌)|布.{0,4}(软硬|挺括)/,
   title:'两块一样厚的布，为什么一件挺、一件塌？',subject:'面料软硬',type:'观众追问',ease:6,tags:['布料','面料','轮廓','样衣'],
   shot:'一只手提毛呢，一只手提软布，同高度松手，让两块布的垂落同框。',ask:'同一个版型换一块布，衣服离身体的距离会变多少？'},
  {id:'style',match:/适合.{0,4}风格|风格太多|衣服都在打架|衣柜.{0,6}杂乱|风格也喜欢/,
   title:'喜欢的风格都收藏了，为什么衣柜还是搭不出一套？',subject:'个人风格',type:'具体求助',ease:3,tags:['风格关键词','衣柜','搭法','现实生活'],
   shot:'把三件单独喜欢、放在一起却难搭的衣服挂成一排，保留一件重新组合。',ask:'这些衣服里，哪一件真的能穿进你明天的日程？'}
];
const signalRules = [
 ['使用反馈',/用了|用过|用完|穿了|穿过|洗了|洗完|半年|一个月后|几个月|缩水|开胶|起球/],
 ['两样比较',/相比|比起|区别|对比|哪个好|怎么选|有啥不同|还是.{1,9}[？?]/],
 ['观众追问',/想看|求演示|能.{0,4}看看|能.{0,4}演示|背面|实测|求教程/],
 ['投稿点评',/我拍的|帮我看看|点评|这张.{0,5}怎么样/],
 ['具体求助',/预算|通勤|学生|身高|适合我|适合什么|请问|求助|怎么买|在哪里买|在哪买/],
 ['观点讨论',/反对|不同意|我觉得|我讨厌|难看|观点|喜欢.{0,8}但/]
];
const stopWords = new Set('这个 那个 一个 可以 就是 怎么 什么 为什么 真的 感觉 一下 还是 有没有 请问 请教 自己 觉得 你们 很多 好看 特别'.split(' '));
const segmenter = new Intl.Segmenter('zh',{granularity:'word'});
function words(text) {
  return new Set([...segmenter.segment(text.toLowerCase())].map(t=>t.segment.trim()).filter(t=>t.length>=2 && /[\p{L}\p{N}]/u.test(t) && !stopWords.has(t)));
}
function tokensOverlap(a,b){return [...a].filter(x=>b.has(x)).length;}
function distinctPeople(rows) {
  const known=new Set(rows.filter(r=>r.who&&!r.author).map(r=>r.url+'|'+r.who));
  return known.size;
}
function short(text,n=32){return text.length>n?text.slice(0,n)+'…':text;}
function analyze(batches) {
 const groups=[];
 for(const b of batches){
  const replies=new Map();
  for(const row of b.rows.filter(r=>r.parent)){
    if(!replies.has(row.parent))replies.set(row.parent,[]);
    replies.get(row.parent).push({...row,url:b.url});
  }
  for(const raw of b.rows.filter(r=>!r.parent)){
    const attached=replies.get(raw.id)||[];
    const row={...raw,url:b.url,work:b.name,replies:attached};
    const rule=angleRules.find(r=>r.match.test(row.text));
    const terms=words(row.text);let g;
    if(rule)g=groups.find(x=>x.rule===rule);
    else g=groups.find(x=>!x.rule&&(x.first===row.text || (tokensOverlap(x.terms,terms)>=2 && tokensOverlap(x.terms,terms)/Math.min(x.terms.size,terms.size)>=.55)));
    if(!g){
     g={key:rule?.id || b.url+'|'+(raw.id||row.text),rule,terms,first:row.text,rows:[],labels:new Set(),sourceUrls:new Set()};
     groups.push(g)
    }
    g.rows.push(row);g.sourceUrls.add(b.url);
    for(const [label,pattern] of signalRules)if(pattern.test(row.text))g.labels.add(label);
  }
 }
 for(const g of groups){
   const all=g.rows.flatMap(r=>[r,...r.replies]);g.people=distinctPeople(all);
   g.count=all.length;g.roots=g.rows.length;
   g.title=g.rule?.title || short(g.rows.find(r=>/[?？]/.test(r.text))?.text || g.first,52);
   if(g.rule)g.labels.add(g.rule.type);
   if(g.rows.filter(r=>/[?？]|怎么|为什么|求|吗|适合什么/.test(r.text)).length>=2)g.labels.add('反复提问');
   const voices=g.rows.map(r=>r.text);
   if(voices.some(t=>/难看|讨厌|不能接受|不喜欢|反对/.test(t)) && voices.some(t=>/太好了|好看|我很喜欢|支持|最喜欢/.test(t)&&!/不喜欢|不好看/.test(t)))g.labels.add('两派争论');
   if(!g.labels.size)g.labels.add('其他讨论');
   g.ease=g.rule?.ease || (g.labels.has('使用反馈')||g.labels.has('观众追问')||g.labels.has('两样比较')?4:g.labels.has('具体求助')?3:1);
   g.replyCount=g.count-g.roots;g.authorReply=all.some(r=>r.parent&&r.author);
 }
 return groups;
}
function suggestedNotes(g,notes){
 const terms=words(g.rows.map(r=>r.text).join(' '));
 return notes.map((n,i)=>{
  const hits=(g.rule?.tags||[]).filter(t=>n.text.includes(t));
  const same=!!n.url&&g.sourceUrls.has(n.url);
  const common=[...terms].filter(t=>(n.text+' '+n.title).includes(t));
  return {i,n,score:(same?14:0)+hits.length*4+common.length,reason:same?'同一条参考作品':[...new Set([...hits,...common])].slice(0,3).join('、')};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3)
}
function compareGroups(a,b,sort) {
 if(sort==='easy' && b.ease!==a.ease)return b.ease-a.ease;
 return b.people-a.people||b.roots-a.roots||b.replyCount-a.replyCount;
}
