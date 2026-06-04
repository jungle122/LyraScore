const localStore = require('../../utils/localStore.js');

Page({
  data: {
    counts: {
      practicing: 0,
      finished: 0,
      deleted: 0
    }
  },
  // --- ✨ 随机抽查逻辑 ---
  randomPick() {
    const db = wx.cloud.database();
    wx.showLoading({ title: '正在抽签...', mask: true });

    // 1. 只查“正在练”的歌
    db.collection('songs')
      .where({ status: 'practicing' })
      .field({ id: true, title: true }) // ⚠️ 关键：只取 id 和 title，省流量
      .get()
      .then(res => {
        wx.hideLoading();
        const list = res.data;
        
        if (list.length === 0) {
          wx.showToast({ title: '没歌可练啦，快去添加吧', icon: 'none' });
          return;
        }

        // 2. 随机算法
        const randomIndex = Math.floor(Math.random() * list.length);
        const luckySong = list[randomIndex];

        // 3. 弹窗展示结果
        wx.showModal({
          title: '命运的安排',
          content: `今天就练这首吧：\n\n🎸 《${luckySong.title}》`,
          confirmText: '去练习',
          confirmColor: '#fa7298',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm) {
              // 4. 跳转到 Reader 页面 (记得带上 id)
              wx.navigateTo({
                url: `/pages/reader/reader?id=${luckySong.id}`
              });
            } else if (r.cancel) {
              // 用户点了"取消"，关闭弹窗即可
              return;
            }
          }
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error(err);
      });
  },

  onShow() {
    this.calculateStats();
  },

  calculateStats() {
    const db = wx.cloud.database();
    
    // 1. 统计正在练
    db.collection('songs').where({ status: 'practicing' }).count().then(res => {
      this.setData({ 'counts.practicing': res.total });
    });

    // 2. 统计已练完
    db.collection('songs').where({ status: 'finished' }).count().then(res => {
      this.setData({ 'counts.finished': res.total });
    });
    
    // 3. 统计回收站
    db.collection('songs').where({ status: 'deleted' }).count().then(res => {
      this.setData({ 'counts.deleted': res.total });
    });
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

  // --- 一次性导出：把云端 songs + 所有 cloud:// 文件落到本地硬盘 ---
  async exportAll() {
    const ok = await new Promise(resolve => {
      wx.showModal({
        title: '导出全部数据',
        content: '将拉取全部曲谱与图片/PDF。请在“微信开发者工具”里点这个按钮（不要在真机上点），导出位置是工具的 USER_DATA_PATH/lyra-export 文件夹。',
        confirmText: '开始',
        confirmColor: '#FA7298',
        success: resolve
      });
    });
    if (!ok.confirm) return;

    wx.showLoading({ title: '拉取曲谱列表...', mask: true });

    try {
      const allSongs = await this.fetchAllSongs();

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

      wx.hideLoading();

      wx.showModal({
        title: '导出完成 🎉',
        content: `共 ${allSongs.length} 首曲谱，下载 ${done}/${totalFiles} 个文件${failed.length ? `，失败 ${failed.length} 个（已记入控制台）` : ''}。\n\n位置：${baseDir}\n\n在微信开发者工具菜单：设置 → 通用设置 → 文件位置，找到“用户数据目录”，进入 lyra-export 即可。`,
        showCancel: false,
        confirmText: '好的'
      });
      if (failed.length) console.warn('未能下载的 cloud 路径：', failed);
    } catch (err) {
      wx.hideLoading();
      console.error('导出失败:', err);
      wx.showModal({
        title: '导出失败',
        content: String((err && err.errMsg) || (err && err.message) || err),
        showCancel: false
      });
    }
  },

  async fetchAllSongs() {
    // ⚠️ 小程序端 .get() 单次最多返回 20 条，与 .limit() 写多少无关
    const PAGE_SIZE = 20;
    const db = wx.cloud.database();
    let all = [];
    let skip = 0;
    while (true) {
      const res = await db.collection('songs').orderBy('_id', 'asc').skip(skip).limit(PAGE_SIZE).get();
      all = all.concat(res.data);
      wx.showLoading({ title: `拉取曲谱 ${all.length}...`, mask: true });
      if (res.data.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }
    return all;
  },

  // --- 一键迁移：把云端 songs + 所有 cloud:// 文件落到「这部手机」的本地存储 ---
  // 跑完后曲谱信息进 wx.setStorage，图片/PDF 进 USER_DATA_PATH/lyra-files，
  // 之后 App 就可以彻底读写本地、不再依赖云开发。请在新手机上运行。
  async migrateToLocal() {
    const existing = localStore.getAllSongs();
    const warn = existing.length
      ? `\n\n⚠️ 本地已有 ${existing.length} 首，继续将「覆盖」本地数据。`
      : '';

    const ok = await new Promise(resolve => {
      wx.showModal({
        title: '迁移到本地',
        content: `将把云端全部曲谱与图片/PDF 下载到这部手机的本地存储，之后即可不再使用云开发。请在你常用的手机上操作。${warn}`,
        confirmText: '开始迁移',
        confirmColor: '#FA7298',
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
      wx.showModal({
        title: '迁移完成 🎉',
        content: `已存入本地 ${allSongs.length} 首曲谱，下载 ${done}/${totalFiles} 个文件${failed.length ? `，失败 ${failed.length} 个（已记入控制台）` : ''}。\n\n数据现已在这部手机本地。下一步可切换 App 读写本地。`,
        showCancel: false,
        confirmText: '好的',
        confirmColor: '#FA7298'
      });
      if (failed.length) console.warn('未能下载的 cloud 路径：', failed);
    } catch (err) {
      wx.hideLoading();
      console.error('迁移失败:', err);
      wx.showModal({
        title: '迁移失败',
        content: String((err && err.errMsg) || (err && err.message) || err),
        showCancel: false
      });
    }
  },

  // 关于
  showAbout() {
    wx.showModal({
      title: '关于 Lyra吉他谱本',
      content: '由 Lyra 开发的私人吉他谱管理工具。\n 图标素材由 iconfont 设计师【落叶寄相思】提供。\n备案号：赣ICP备2026002165号-1X\n 联系作者：congconglinr@foxmail.com \n Version 2.2.0',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#FA7298' // 使用你的主题粉色
    });
  },
  // 分享给朋友
  onShareAppMessage() {
    return app.globalShare();
  },

  // 分享到朋友圈
  onShareTimeline() {
    // 朋友圈模版通常只需要一个标题
    return {
      title: 'Lyra吉他谱本 - 吉他手的私人云端琴房',
      imageUrl: '/images/icon.png'
    }
  }
});