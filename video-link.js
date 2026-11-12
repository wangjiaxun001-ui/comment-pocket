// Keep only the public work identifier or short code, including when pasted with tracking parameters.
function parseVideoLink(text) {
  const urls=String(text).match(/https?:\/\/[^\s<>"'，。！？；、（）【】《》\u4e00-\u9fff]+/gi)||[];
  for(const raw of urls){
    let u;
    try{u=new URL(raw.replace(/[).,;!\]}]+$/g,''))}catch{continue}
    if(u.username||u.password||u.port)continue;
    if(u.hostname==='v.douyin.com'){
      const code=u.pathname.match(/^\/([a-z\d_-]{3,80})\/?$/i)?.[1];
      if(code)return {short:true,url:'https://v.douyin.com/'+code+'/'};
    }
    if(!['www.douyin.com','douyin.com','www.iesdouyin.com','iesdouyin.com'].includes(u.hostname))continue;
    const id=u.pathname.match(/^\/(?:share\/)?video\/(\d{10,22})(?:\/|$)/)?.[1]||u.searchParams.get('modal_id');
    if(/^\d{10,22}$/.test(id||''))return {short:false,url:'https://www.douyin.com/video/'+id};
  }
  throw Error('没有找到抖音视频链接。请在作品的「分享」里点「复制链接」，把整段文字粘贴到这里。');
}
