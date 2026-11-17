const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const filters=require('../utils/songFilters');
const base={selectedInstrument:'all',selectedStyle:'all',selectedType:'all',selectedSort:'newest'};
const time=1700000000000;
function environment(seed={}){
 const records={songs:[],playlists:[],...structuredClone(seed)};const storage={};const calls=[];let page;let next=1;
 const failures={writes:new Set(),files:new Set()};
 const cmd={addToSet:value=>({op:'add',value}),pull:value=>({op:'pull',value}),in:value=>({op:'in',value})};
 function matches(s,q){return Object.entries(q).every(([key,value])=>{if(value==='{openid}')value='owner';return Array.isArray(s[key])?s[key].includes(value):s[key]===value;});}
 function query(collection,where={}){
  let skip=0,limit=20;
  const current=()=>{if(!records[collection])throw new Error('DATABASE_COLLECTION_NOT_EXIST');return records[collection].filter(s=>matches(s,where));};
  return {where:q=>query(collection,q),orderBy(){return this},skip(n){skip=n;return this},limit(n){limit=n;return this},
   async get(){calls.push({type:'get',collection,where});return {data:structuredClone(current().slice(skip,skip+limit))};},
   async update({data}){let updated=0;for(const song of current()){if(failures.writes.has(song._id))throw new Error('network failure');for(const [k,v]of Object.entries(data)){if(v?.op==='add'){song[k]=[...new Set([...(song[k]||[]),...(v.value.$each||[v.value])])];}else if(v?.op==='pull'){const values=v.value?.op==='in'?v.value.value:[v.value];song[k]=(song[k]||[]).filter(x=>!values.includes(x));}else song[k]=structuredClone(v);}updated++;}return {stats:{updated}};},
   async remove(){const ids=current().map(s=>s._id);records[collection]=records[collection].filter(s=>!ids.includes(s._id));return {stats:{removed:ids.length}};},
   async add({data}){const _id='new-'+next++;records[collection].push({...structuredClone(data),_id,_openid:'owner'});return {_id};}
  };
 }
 const database={command:cmd,collection:n=>query(n)};
 const wx={cloud:{database:()=>database,deleteFile:async({fileList})=>({fileList:fileList.map(fileID=>{calls.push({type:'deleteFile',fileID});return {fileID,status:failures.files.has(fileID)?-1:0};})})},
 getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,setTabBarStyle:o=>calls.push({type:'tab',...o}),setTabBarItem:o=>calls.push({type:'icon',...o}),
 showToast:o=>calls.push({type:'toast',...o}),showLoading(){},hideLoading(){},setNavigationBarTitle(){},navigateBack(){},navigateTo:o=>calls.push(o),showModal:async()=>({confirm:true,content:'歌单'}),showActionSheet:async()=>({tapIndex:0})};
 const cache={};
 function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const module={exports:{}};cache[file]=module;vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:p=>load(path.resolve(path.dirname(file),p+'.js')),wx,Page:p=>page=p,console,setTimeout(){},getApp:()=>({globalShare:()=>({})})},{filename:file});return module.exports;}
 function loadPage(name){load(`pages/${name}/${name}.js`);page.setData=function(patch){Object.assign(this.data,patch)};return page;}
 return {records,calls,storage,failures,load,loadPage,wx};
}
const own=s=>({_openid:'owner',...s});
test('合并旧状态；排序忽略修改时间并读取旧日期字段',()=>{
 const rows=[{_id:'a',id:time,status:'practicing',updateTime:time+99999},{_id:'b',id:String(time+1000),status:'finished'},{_id:'c',createdAt:time+2000,status:'active'},{_id:'d',id:'bad',createTime:'2026/9/8'},{_id:'e',id:time+999,status:'trash'}];
 assert.deepEqual(filters.filterSongs(rows,'active',base).map(s=>s._id),['d','c','b','a']);assert.deepEqual(filters.filterSongs(rows,'active',{...base,selectedSort:'oldest'}).map(s=>s._id),['a','b','c','d']);
 assert.equal(filters.storedAt({createdAt:time,id:time+100}),time);
});
test('MySQL 迁移兼容 ID 不会被显示为 2033 年',()=>{
 const actual=new Date(2022,4,18,9,30,0).getTime();
 assert.equal(filters.storedAt({id:2000000000001,createTime:'2022-05-18 09:30:00'}),actual);
 assert.equal(filters.storedAt({id:2000000000002,createTime:''}),null);
 assert.equal(filters.filterSongs([{_id:'m',id:2000000000001,createTime:'2022-05-18 09:30:00'}],'active',base)[0].storedDateText,'2022/5/18');
});
test('三个维度取交集，支持中英文及未分类，旧文字谱可读取',()=>{
 const rows=[{_id:'a',instrument:'吉他',style:'指弹',type:'image'},{_id:'b',instrument:'guitar',style:'picking',type:'paper'},{_id:'c',type:'blank'}];
 assert.deepEqual(filters.filterSongs(rows,'active',{...base,selectedInstrument:'guitar',selectedStyle:'picking',selectedType:'image'}).map(s=>s._id),['a']);
 assert.deepEqual(filters.filterSongs(rows,'active',{...base,selectedInstrument:'unknown',selectedType:'blank'}).map(s=>s._id),['c']);
});
test('同时间有稳定次序且不改变输入',()=>{const rows=[{_id:'z',id:time},{_id:'a',id:time}];assert.deepEqual(filters.filterSongs(rows,'active',base).map(s=>s._id),['a','z']);assert.equal(rows[0]._id,'z');});
test('用户隔离查询、超过20条分页、筛选不发请求及返回保留条件',async()=>{
 const e=environment({songs:Array.from({length:26},(_,i)=>own({_id:String(i),id:time+i,instrument:i%2?'guitar':'ukulele'})).concat({_id:'foreign',_openid:'other'})});
 const p=e.loadPage('library');await p.onShow();assert.equal(p.data.songList.length,26);assert.equal(e.calls.filter(c=>c.type==='get').length,2);
 p.openFilters();p.changeDraftFilter({currentTarget:{dataset:{key:'selectedInstrument',value:'guitar'}}});p.data.selectedIds=['0'];p.confirmFilters();assert.equal(p.data.songList.length,13);assert.equal(p.data.selectedIds.length,0);assert.equal(e.calls.filter(c=>c.type==='get').length,2);
 await p.onShow();assert.equal(p.data.selectedInstrument,'guitar');assert.equal(p.data.songList.length,13);
 p.data.selectedIds=['0','1'];p.applyFilters();assert.deepEqual(Array.from(p.data.selectedIds),['1']);
});
test('歌单名称校验、重复名、改名与跨用户数据隔离',async()=>{
 const e=environment({playlists:[own({_id:'p',name:'收藏'}),{_id:'other',name:'他人的',_openid:'other'}]});const lib=e.load('utils/library.js');
 await assert.rejects(lib.savePlaylist('  '));await assert.rejects(lib.savePlaylist('字'.repeat(31)));await assert.rejects(lib.savePlaylist(' 收藏 '));
 const id=await lib.savePlaylist(' 新歌单 ');await lib.savePlaylist('改名',id);assert.equal(e.records.playlists.find(p=>p._id===id).name,'改名');
 await assert.rejects(lib.savePlaylist('非法修改','other'));assert.equal((await lib.all('playlists')).length,2);
});
test('多歌单成员原子去重；批量部分失败可重试；移除不删除曲谱',async()=>{
 const e=environment({songs:[own({_id:'s'}),own({_id:'f'})],playlists:[own({_id:'p'}),own({_id:'q'})]});const lib=e.load('utils/library.js');e.failures.writes.add('f');
 const first=await lib.changeMembership(['s','f'],['p','q']);assert.equal(first.succeeded.length,1);assert.equal(first.failed.length,1);
 e.failures.writes.clear();await lib.changeMembership(['s','f'],['p','q']);assert.deepEqual(e.records.songs[0].playlistIds,['p','q']);await lib.changeMembership(['s'],['p'],true);assert.deepEqual(e.records.songs[0].playlistIds,['q']);assert.equal(e.records.songs.length,2);
 await lib.changeMembership(['s'],['q']);assert.deepEqual(e.records.songs[0].playlistIds,['q']);
});
test('删除歌单保留曲谱并清理关联；软删除隐藏数量，恢复带回关联',async()=>{
 const e=environment({songs:[own({_id:'s',playlistIds:['p','q'],status:'finished'})],playlists:[own({_id:'p',createdAt:time}),own({_id:'q',createdAt:time+1})]});const lib=e.load('utils/library.js');
 await lib.trashSongs(['s']);assert.equal((await lib.playlistsWithCounts())[0].count,0);await lib.restoreSong('s');assert.equal((await lib.playlistsWithCounts())[0].count,1);await lib.deletePlaylist('p');assert.deepEqual(e.records.songs[0].playlistIds,['q']);assert.equal(e.records.songs.length,1);
});
test('附件引用保护，部分清理失败禁止恢复，重试跳过已清理文件',async()=>{
 const e=environment({songs:[own({_id:'s',status:'deleted',imagePaths:['cloud://shared','cloud://a','cloud://b']}),own({_id:'other',imagePaths:['cloud://shared']})]});const lib=e.load('utils/library.js');e.failures.files.add('cloud://b');
 await assert.rejects(lib.purgeSong('s'));assert.equal(e.records.songs[0].purgeStarted,true);assert.deepEqual(e.records.songs[0].purgedFiles,['cloud://a']);await assert.rejects(lib.restoreSong('s'));
 e.failures.files.clear();await lib.purgeSong('s');assert.equal(e.records.songs.length,1);assert.equal(e.calls.filter(c=>c.fileID==='cloud://a').length,1);assert.equal(e.calls.filter(c=>c.fileID==='cloud://shared').length,0);
});
test('集合缺失显示错误，不误报空歌单',async()=>{const e=environment();delete e.records.playlists;const p=e.loadPage('playlists');await p.onShow();assert.match(p.data.error,/尚未配置/);});
test('搜索将括号、星号等当普通文本，排除回收站',async()=>{const e=environment({songs:[own({_id:'a',title:'歌名(*',status:'finished'}),own({_id:'b',title:'歌名(*',status:'deleted'})]});const p=e.loadPage('search');await p.onShow();p.onSearchInput({detail:{value:'(*'}});assert.equal(p.data.resultList.length,1);p.clearSearch();assert.equal(p.data.resultList.length,0);});
test('编辑不覆盖存入时间；禁止意外切换曲谱类型；验证失败后允许重试',async()=>{
 const e=environment({songs:[own({_id:'s',id:time,createdAt:time,type:'paper',title:'旧曲谱'})]});const p=e.loadPage('editor');p.uploadAllImages=async()=>[];p.uploadAllFiles=async()=>[];
 await p.loadSongFromCloud({uid:'s'});p.data.title='修改标题';await p.save();assert.equal(e.records.songs[0].createdAt,time);assert.equal(e.records.songs[0].id,time);
 p.data.type='blank';p.data.title='不应保存';await p.save();assert.equal(e.records.songs[0].title,'修改标题');
 Object.assign(p.data,{_id:null,id:null,type:'image',readOnly:false});await p.save();assert.equal(p._saving,false);
 p.data.type='paper';await p.save();assert.equal(e.records.songs[1].createdAt,e.records.songs[1].id);assert.equal(e.records.songs[1].status,'active');
});
test('主题默认粉色、即时同步、重启记忆、坏值回退，底栏同步',()=>{
 const e=environment();const theme=e.load('utils/theme.js');assert.equal(theme.read(),'pink');const p=e.loadPage('playlists');p.onLoad();theme.set('neutral');assert.equal(p.data.themeId,'neutral');assert.equal(e.storage.lyra_theme,'neutral');assert.equal(e.calls.filter(c=>c.type==='icon').at(-1).selectedIconPath,'images/remix/user-neutral.png');
 theme.read();assert.equal(theme.data().themePrimary,'#333333');e.storage.lyra_theme='bad';assert.equal(theme.read(),'pink');p.onUnload();
});

test('文字谱新建、读取、编辑保留正文、元数据与存入日期',async()=>{
 const e=environment();const p=e.loadPage('editor');p.onLoad({type:'blank'});
 Object.assign(p.data,{title:'自制谱',content:'C  G\n第一行歌词\n第二行',key:'G',originalKey:'A',capo:2,timeSignature:'3/4',bpm:108,tuning:'Drop D'});
 await p.save();const song=e.records.songs[0];assert.equal(song.type,'blank');assert.equal(song.content,p.data.content);assert.equal(song.key,'G');assert.equal(song.capo,2);assert.equal(song.bpm,108);assert.equal(song.status,'active');
 const created=song.createdAt;await p.loadSongFromCloud({uid:song._id});assert.equal(p.data.readOnly,false);assert.equal(p.data.tuning,'Drop D');assert.equal(p.data.timeSignature,'3/4');
 p.data.content+='\n新增一行';await p.save();assert.equal(e.records.songs[0].content,p.data.content);assert.equal(e.records.songs[0].createdAt,created);assert.equal(e.records.songs.length,1);
});
test('旧文字谱可编辑，保存保留状态及歌单关联',async()=>{
 const e=environment({songs:[own({_id:'legacy',id:time,createdAt:time,type:'blank',title:'旧谱',content:'Am\n原歌词',status:'finished',playlistIds:['p']})]});const p=e.loadPage('editor');
 await p.loadSongFromCloud({uid:'legacy'});assert.equal(p.data.readOnly,false);assert.equal(p.data.content,'Am\n原歌词');p.data.title='改标题';await p.save();
 assert.equal(e.records.songs[0].content,'Am\n原歌词');assert.equal(e.records.songs[0].status,'finished');assert.deepEqual(e.records.songs[0].playlistIds,['p']);assert.equal(e.records.songs[0].createdAt,time);
});
test('跟随系统实时更新、手动模式覆盖系统、导航与回弹背景同步',()=>{
 const e=environment();let system='dark',changed;let registrations=0;
 e.wx.getAppBaseInfo=()=>({theme:system});e.wx.onThemeChange=fn=>{changed=fn;registrations++};
 e.wx.setBackgroundColor=o=>e.calls.push({type:'background',...o});e.wx.setNavigationBarColor=o=>e.calls.push({type:'navigation',...o});
 const t=e.load('utils/theme.js');const p=e.loadPage('playlists');p.onLoad();p.onShow();assert.equal(p.data.appearance,'system');assert.equal(p.data.isDark,true);assert.equal(registrations,1);
 assert.equal(e.calls.findLast(c=>c.type==='background').backgroundColorTop,'#171717');assert.equal(e.calls.findLast(c=>c.type==='navigation').frontColor,'#ffffff');
 t.set('neutral');assert.equal(p.data.themeIcon,'light');assert.equal(e.calls.findLast(c=>c.type==='icon').selectedIconPath,'images/remix/user-light.png');
 t.setAppearance('light');changed({theme:'dark'});assert.equal(p.data.isDark,false);assert.equal(e.calls.findLast(c=>c.type==='background').backgroundColorBottom,'#F8F8F8');
 t.setAppearance('dark');system='light';changed({theme:system});assert.equal(p.data.isDark,true);t.read();assert.equal(t.data().appearance,'dark');
 t.setAppearance('system');assert.equal(p.data.isDark,false);system='dark';changed({theme:system});assert.equal(p.data.isDark,true);
 const before=p.data.isDark;p.onUnload();system='light';changed({theme:system});assert.equal(p.data.isDark,before);
});
