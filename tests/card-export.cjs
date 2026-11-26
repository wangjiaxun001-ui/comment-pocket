const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({URL});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../card-export.js'),'utf8'),context);
const {formatTopicCard,formatTopicCards}=context;

test('one card includes writing, viewer replies, notes and exact reference provenance',()=>{
 const card={key:'one',fields:{title:'裤脚怎么选',idea:'先看比例\n再看场景',shot:'侧面近景',ask:'你喜欢哪种',noteTitle:'拍法示例',note:'同机位比较',noteUrl:'https://example.com/note'},evidence:[{text:'小个子适合吗',replies:[{text:'先看鞋型',author:true},{text:'我也想知道'}],work:'对比作品',url:'https://example.com/video'}]};
 const clip={id:'7701656133378788644',s:12.345,e:78.75,t:'裤脚落在鞋面上',note:'借鉴近景解释',title:'鞋裤关系'};
 assert.equal(formatTopicCard(card,[clip]),[
 '裤脚怎么选','我的写作思路\n先看比例\n再看场景','第一镜　侧面近景','追问　你喜欢哪种',
 '观众原话\n“小个子适合吗”\n作者回复　先看鞋型\n回复　我也想知道\n作品　对比作品\nhttps://example.com/video',
 '参考口播 0:12 至 1:18\n裤脚落在鞋面上\n参考点　借鉴近景解释\n作品　鞋裤关系\nhttps://www.douyin.com/video/7701656133378788644',
 '关联拍法\n拍法示例\n同机位比较\nhttps://example.com/note'
 ].join('\n\n'));
});

test('minimal or old cards omit empty fields; missing data never becomes undefined text',()=>{
 assert.equal(formatTopicCard({fields:{title:'只记一句灵感'}}),'只记一句灵感');
 assert.equal(formatTopicCard(null),'');
 assert.equal(formatTopicCard({fields:{title:' ',shot:'',note:''},evidence:[null,{}, {replies:[null]}]},[null,{}]),'');
 assert.equal(formatTopicCard({fields:{title:'旧卡'},evidence:[{text:'一条原话'}]}),'旧卡\n\n观众原话\n“一条原话”');
});

test('unsafe source URLs and invalid timing cannot enter exported provenance',()=>{
 const output=formatTopicCard({fields:{title:'两行\n标题',idea:'第一段\n\n第二段',note:'笔记',noteUrl:'javascript:alert(1)'},evidence:[{text:'正文',url:'file:///private/file',work:'来源名'}]},[{t:'口播原话',id:'javascript:alert(1)',s:-1,e:3,title:'视频'}]);
 assert.match(output,/第一段\n\n第二段/);
 assert.match(output,/来源名/);
 assert.doesNotMatch(output,/javascript:|file:|NaN|undefined|参考口播 -/);
 assert.match(output,/参考口播\n口播原话\n作品　视频/);
});

test('multi-card export keeps input order, uses the shared format and never changes cards',()=>{
 const a={key:'a',fields:{title:'甲'}},b={key:'b',fields:{title:'乙',idea:'第二篇思路'}},cards=[a,b];
 const before=JSON.stringify(cards),lookups=[];
 const clips=[{id:'7701656133378788644',s:1,e:3,t:'乙的参考'}];
 const output=formatTopicCards(cards,key=>{lookups.push(key);return key==='b'?clips:[]});
 assert.deepEqual(lookups,['a','b']);
 assert.equal(output,'【选题 1】\n'+formatTopicCard(a)+'\n\n════════════════════\n\n【选题 2】\n'+formatTopicCard(b,clips));
 assert.equal(JSON.stringify(cards),before);
 assert.equal(formatTopicCards([]),'');
});
