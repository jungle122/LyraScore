const localStore = require('../../utils/localStore.js');
const library=require('../../utils/library');
const theme=require('../../utils/theme');
const {statusOf}=require('../../utils/songFilters');

Page(require('../../utils/theme').page({
  data:{counts:{songs:0,playlists:0,deleted:0},statsError:'',showTheme:false},
  onShow(){return this.calculateStats();},
  async calculateStats(){
    this.setData({statsError:''});
    try{const [songs,playlists]=await Promise.all([library.all('songs'),library.all('playlists')]);
      this.setData({counts:{songs:songs.filter(library.isActive).length,playlists:playlists.length,deleted:songs.filter(s=>statusOf(s.status)==='deleted').length}});
    }catch(e){this.setData({statsError:library.errorText(e)});}
  },
  openTheme(){this.setData({showTheme:true});},
  closeTheme(){this.setData({showTheme:false});},
  noop(){},
  chooseTheme(e){try{theme.set(e.currentTarget.dataset.id);}catch(_){wx.showToast({title:'主题保存失败，请重试',icon:'none'});}},
  chooseAppearance(e){try{theme.setAppearance(e.currentTarget.dataset.id);}catch(_){wx.showToast({title:'外观保存失败，请重试',icon:'none'});}},
  async randomPick(){
    try{const songs=(await library.all('songs')).filter(library.isActive);if(!songs.length){wx.showToast({title:'先添加一首曲谱吧',icon:'none'});return;}
      const song=songs[Math.floor(Math.random()*songs.length)];
      const res=await theme.modal({title:'随机抽一首',content:song.title,confirmText:'查看曲谱'});
      if(res.confirm)wx.navigateTo({url:'/pages/reader/reader?uid='+encodeURIComponent(song._id)});
    }catch(e){wx.showToast({title:library.errorText(e),icon:'none'});}
  },
  // --- 简单的跳转逻辑 ---
  
  // 去回收站页面
  goToTrash() {
    wx.navigateTo({ url: '/pages/trash/trash' });
  },
  // ✨ 新增占位函数
  goToTuner() {
    wx.navigateTo({ url: '/pages/tuner/tuner' });
  },

  goToMetronome() {
    wx.navigateTo({ url: '/pages/metronome/metronome' });
  },

  // --- 数据备份：把云端 songs + 所有 cloud:// 文件保存到本地硬盘 ---
  async exportAll() {
    const ok = await new Promise(resolve => {
      require('../../utils/theme').modal({
        title: '备份全部数据到电脑',
        content: '将拉取全部曲谱与图片/PDF。请在“微信开发者工具”里点这个按钮（不要在真机上点），导出位置是工具的 USER_DATA_PATH/lyra-export 文件夹。',
        confirmText: '开始',
        confirmColor: require('../../utils/theme').data().themePrimary,
        success: resolve
      });
    });
    if (!ok.confirm) return;

    wx.showLoading({ title: '拉取曲谱列表...', mask: true });

    try {
      const allSongs = await this.fetchAllSongs();
      const allPlaylists = await library.all('playlists');

      const fs = wx.getFileSystemManager();
      const baseDir = `${wx.env.USER_DATA_PATH}/lyra-export`;
      const filesDir = `${baseDir}/files`;
      try { fs.mkdirSync(baseDir, true); } catch (e) {}
      try { fs.mkdirSync(filesDir, true); } catch (e) {}

      let totalFiles = 0;
      allSongs.forEach(s => {
        if (Array.isArray(s.imagePaths)) totalFiles += s.imagePaths.filter(p => p && p.startsWith('cloud://')).length;
        if (Array.isArray(s.filePaths)) totalFiles += s.filePaths.filter(p => p && p.startsWith('cloud://')).length;
        if (s.imagePath && s.imagePath.startsWith('cloud://')) totalFiles += 1;
      });

      let done = 0;
      const failed = [];

      const downloadOne = async (cloudPath) => {
        const filename = decodeURIComponent(cloudPath.split('/').pop() || `unknown-${Date.now()}`);
        const localPath = `${filesDir}/${filename}`;
        try { fs.accessSync(localPath); return `files/${filename}`; } catch (e) {}
        try {
          const res = await wx.cloud.downloadFile({ fileID: cloudPath });
          fs.copyFileSync(res.tempFilePath, localPath);
          done += 1;
          wx.showLoading({ title: `下载文件 ${done}/${totalFiles}`, mask: true });
          return `files/${filename}`;
        } catch (err) {
          console.error('下载失败:', cloudPath, err);
          failed.push(cloudPath);
          return cloudPath; // 保留原路径，便于事后排查
        }
      };

      const mapPaths = async (arr) => {
        if (!Array.isArray(arr)) return arr;
        const out = [];
        for (const p of arr) {
          out.push(p && p.startsWith('cloud://') ? await downloadOne(p) : p);
        }
        return out;
      };

      for (const song of allSongs) {
        song.imagePaths = await mapPaths(song.imagePaths);
        song.filePaths = await mapPaths(song.filePaths);
        if (song.imagePath && song.imagePath.startsWith('cloud://')) {
          song.imagePath = await downloadOne(song.imagePath);
        }
      }

      const jsonPath = `${baseDir}/songs.json`;
      fs.writeFileSync(jsonPath, JSON.stringify(allSongs, null, 2), 'utf8');
      fs.writeFileSync(baseDir + '/playlists.json',JSON.stringify(allPlaylists,null,2),'utf8');

      wx.hideLoading();

      require('../../utils/theme').modal({
        title: '备份完成 🎉',
        content: `共 ${allSongs.length} 首曲谱，下载 ${done}/${totalFiles} 个文件${failed.length ? `，失败 ${failed.length} 个（已记入控制台）` : ''}。\n\n位置：${baseDir}\n\n在微信开发者工具菜单：设置 → 通用设置 → 文件位置，找到“用户数据目录”，进入 lyra-export 即可。`,
        showCancel: false,
        confirmText: '好的'
      });
      if (failed.length) console.warn('未能下载的 cloud 路径：', failed);
    } catch (err) {
      wx.hideLoading();
      console.error('备份失败:', err);
      require('../../utils/theme').modal({
        title: '备份失败',
        content: String((err && err.errMsg) || (err && err.message) || err),
        showCancel: false
      });
    }
  },

  fetchAllSongs(){return library.all('songs');},

  // --- 一键迁移：把云端 songs + 所有 cloud:// 文件落到「这部手机」的本地存储 ---
  // 跑完后曲谱信息进 wx.setStorage，图片/PDF 进 USER_DATA_PATH/lyra-files，
  // 之后 App 就可以彻底读写本地、不再依赖云开发。请在新手机上运行。
  async migrateToLocal() {
    const existing = localStore.getAllSongs();
    const warn = existing.length
      ? `\n\n⚠️ 本地已有 ${existing.length} 首，继续将「覆盖」本地数据。`
      : '';

    const ok = await new Promise(resolve => {
      require('../../utils/theme').modal({
        title: '迁移到本地',
        content: `将把云端全部曲谱与图片/PDF 下载到这部手机的本地存储，之后即可不再使用云开发。请在你常用的手机上操作。${warn}`,
        confirmText: '开始迁移',
        confirmColor: require('../../utils/theme').data().themePrimary,
        success: resolve
      });
    });
    if (!ok.confirm) return;

    wx.showLoading({ title: '拉取曲谱列表...', mask: true });

    try {
      const allSongs = await this.fetchAllSongs();

      // 统计需要下载的云端文件总数，便于显示进度
      let totalFiles = 0;
      allSongs.forEach(s => {
        if (Array.isArray(s.imagePaths)) totalFiles += s.imagePaths.filter(p => p && p.startsWith('cloud://')).length;
        if (Array.isArray(s.filePaths)) totalFiles += s.filePaths.filter(p => p && p.startsWith('cloud://')).length;
        if (s.imagePath && s.imagePath.startsWith('cloud://')) totalFiles += 1;
      });

      let done = 0;
      const failed = [];

      // 下载单个 cloud:// 文件到本地，返回本地路径；失败则保留原 cloud 路径
      const pullOne = async (cloudPath) => {
        const ext = (decodeURIComponent(cloudPath).split('.').pop() || 'dat').split('?')[0];
        try {
          const res = await wx.cloud.downloadFile({ fileID: cloudPath });
          const localPath = localStore.saveTempFile(res.tempFilePath, ext);
          done += 1;
          wx.showLoading({ title: `下载文件 ${done}/${totalFiles}`, mask: true });
          return localPath;
        } catch (err) {
          console.error('下载失败:', cloudPath, err);
          failed.push(cloudPath);
          return cloudPath;
        }
      };

      const mapPaths = async (arr) => {
        if (!Array.isArray(arr)) return arr;
        const out = [];
        for (const p of arr) {
          out.push(p && p.startsWith('cloud://') ? await pullOne(p) : p);
        }
        return out;
      };

      for (const song of allSongs) {
        song.imagePaths = await mapPaths(song.imagePaths);
        song.filePaths = await mapPaths(song.filePaths);
        if (song.imagePath && song.imagePath.startsWith('cloud://')) {
          song.imagePath = await pullOne(song.imagePath);
        }
        // 确保每条都有本地用的 _id（沿用云端 _id，没有则按 id 生成）
        if (!song._id) song._id = `local_${song.id || Date.now()}_${Math.floor(Math.random() * 100000)}`;
      }

      localStore.saveAllSongs(allSongs);

      wx.hideLoading();
      require('../../utils/theme').modal({
        title: '迁移完成 🎉',
        content: `已存入本地 ${allSongs.length} 首曲谱，下载 ${done}/${totalFiles} 个文件${failed.length ? `，失败 ${failed.length} 个（已记入控制台）` : ''}。\n\n数据现已在这部手机本地。下一步可切换 App 读写本地。`,
        showCancel: false,
        confirmText: '好的',
        confirmColor: require('../../utils/theme').data().themePrimary
      });
      if (failed.length) console.warn('未能下载的 cloud 路径：', failed);
    } catch (err) {
      wx.hideLoading();
      console.error('迁移失败:', err);
      require('../../utils/theme').modal({
        title: '迁移失败',
        content: String((err && err.errMsg) || (err && err.message) || err),
        showCancel: false
      });
    }
  },

  // 关于
  showAbout() {
    require('../../utils/theme').modal({
      title: '关于 Lyra吉他谱本',
      content: '由 Lyra 开发的私人吉他谱管理工具。\n 界面图标使用 Remix Icon；部分原有素材来自 iconfont 设计师【落叶寄相思】。\n备案号：赣ICP备2026002165号-1X\n 联系作者：congconglinr@foxmail.com \n Version 2.2.0',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: require('../../utils/theme').data().themePrimary // 使用你的主题粉色
    });
  },
  // 分享给朋友
  onShareAppMessage() {
    return getApp().globalShare();
  },

  // 分享到朋友圈
  onShareTimeline() {
    // 朋友圈模版通常只需要一个标题
    return {
      title: 'Lyra吉他谱本 - 吉他手的私人云端琴房',
      imageUrl: '/images/icon.png'
    }
  }
}));
