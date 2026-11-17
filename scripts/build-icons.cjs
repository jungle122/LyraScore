// 固定 Remix Icon 版本，保留 SVG 源文件并输出原生 tabBar 使用的 PNG。
const fs=require('node:fs');const path=require('node:path');
const {Resvg}=require('../.runtime/node_modules/@resvg/resvg-js');
const root=path.resolve(__dirname,'..','images','remix');fs.mkdirSync(path.join(root,'src'),{recursive:true});
const sources={score:'Document/file-music-line',playlist:'Media/play-list-2-line',add:'System/add-line',user:'User & Faces/user-line',search:'System/search-line',filter:'System/filter-3-line',more:'System/more-2-line',palette:'Design/palette-line',camera:'Media/camera-3-line',book:'Document/book-open-line',dice:'Game & Sports/dice-line',tuner:'Media/equalizer-line',timer:'System/timer-line',trash:'System/delete-bin-line',info:'System/information-line'};
async function download(url){const relative=decodeURIComponent(url.split('/v4.9.0/')[1]);return fs.readFileSync(path.resolve(__dirname,'../.runtime/node_modules/remixicon',relative),'utf8');}
(async()=>{
 for(const [name,icon]of Object.entries(sources)){
  const svg=await download(`https://raw.githubusercontent.com/Remix-Design/RemixIcon/v4.9.0/icons/${icon}.svg`);
  fs.writeFileSync(path.join(root,'src',name+'.svg'),svg);
  for(const [theme,color]of Object.entries({gray:'#999999',pink:'#FA7298',neutral:'#333333',light:'#E6E6E6'})){
   const colored=svg.replace(/fill="currentColor"/g,`fill="${color}"`);
   const image=new Resvg(colored,{fitTo:{mode:'width',value:81}}).render().asPng();
   fs.writeFileSync(path.join(root,`${name}-${theme}.png`),image);
  }
 }
 const license=await download('https://raw.githubusercontent.com/Remix-Design/RemixIcon/v4.9.0/License');
 fs.writeFileSync(path.join(root,'LICENSE.txt'),license);
 fs.writeFileSync(path.join(root,'README.md'),'# Remix Icon 图标\n\n来源：https://github.com/Remix-Design/RemixIcon/tree/v4.9.0\n\n版本：v4.9.0。许可原文见 LICENSE.txt。src/ 保留原始 SVG；PNG 为透明背景 81×81，灰色、粉色、深灰、浅灰四种颜色。\n\n安装本地转换工具后运行 `node scripts/build-icons.cjs` 可重新生成。\n');
 console.log(`Generated ${Object.keys(sources).length} SVG sources and ${Object.keys(sources).length * 4} PNG icons.`);
})().catch(e=>{console.error(e);process.exitCode=1});
