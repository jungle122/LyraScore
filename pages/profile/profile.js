const localStore = require('../../utils/localStore.js');

Page({
  data: {
    counts: {
      practicing: 0,
      finished: 0,
      deleted: 0
    }
  },
  // --- ✨ 随机抽查逻辑（从本地"正在练"里抽）---
  randomPick() {
    const list = localStore.getAllSongs().filter(item => item.status === 'practicing');

    if (list.length === 0) {
      wx.showToast({ title: '没歌可练啦，快去添加吧', icon: 'none' });
      return;
    }

    const randomIndex = Math.floor(Math.random() * list.length);
    const luckySong = list[randomIndex];

    wx.showModal({
      title: '命运的安排',
      content: `今天就练这首吧：\n\n🎸 《${luckySong.title}》`,
      confirmText: '去练习',
      confirmColor: '#fa7298',
      cancelText: '取消',
      success: (r) => {
        if (r.confirm) {
          wx.navigateTo({ url: `/pages/reader/reader?id=${luckySong.id}` });
        }
      }
    });
  },

  onShow() {
    this.calculateStats();
  },

  calculateStats() {
    const all = localStore.getAllSongs();
    const countBy = (s) => all.filter(item => item.status === s).length;
    this.setData({
      'counts.practicing': countBy('practicing'),
      'counts.finished': countBy('finished'),
      'counts.deleted': countBy('deleted')
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

  // --- 备份：把本地全部曲谱与图片/PDF 导出到 lyra-export 文件夹 ---
  // 主要在「微信开发者工具」里用，导出后可在 用户数据目录/lyra-export
  // 拿到 songs.json 和 files/，作为离线备份。
  exportAll() {
    wx.showModal({
      title: '导出备份',
      content: '将把本地全部曲谱与图片/PDF 复制到 lyra-export 文件夹作为备份。建议在「微信开发者工具」里操作，方便在电脑上取到文件。',
      confirmText: '开始',
      confirmColor: '#FA7298',
      success: (ok) => {
        if (ok.confirm) this.doExport();
      }
    });
  },

  doExport() {
    wx.showLoading({ title: '导出中...', mask: true });
    try {
      // 深拷贝，避免改到内存里的真实数据
      const allSongs = JSON.parse(JSON.stringify(localStore.getAllSongs()));

      const fs = wx.getFileSystemManager();
      const baseDir = `${wx.env.USER_DATA_PATH}/lyra-export`;
      const filesDir = `${baseDir}/files`;
      try { fs.mkdirSync(baseDir, true); } catch (e) {}
      try { fs.mkdirSync(filesDir, true); } catch (e) {}

      let copied = 0;
      const failed = [];

      // 把一个本地文件复制进 lyra-export/files，路径改成相对路径 files/xxx
      const copyOne = (localPath) => {
        if (!localPath || typeof localPath !== 'string') return localPath;
        if (localPath.indexOf(localStore.FILES_DIR) !== 0) return localPath; // 非本地文件，原样保留
        const filename = localPath.split('/').pop();
        const dest = `${filesDir}/${filename}`;
        try {
          try { fs.accessSync(dest); } catch (e) { fs.copyFileSync(localPath, dest); copied += 1; }
          return `files/${filename}`;
        } catch (err) {
          console.error('复制失败:', localPath, err);
          failed.push(localPath);
          return localPath;
        }
      };

      const mapPaths = (arr) => (Array.isArray(arr) ? arr.map(copyOne) : arr);

      allSongs.forEach(song => {
        song.imagePaths = mapPaths(song.imagePaths);
        song.filePaths = mapPaths(song.filePaths);
        if (song.imagePath) song.imagePath = copyOne(song.imagePath);
      });

      fs.writeFileSync(`${baseDir}/songs.json`, JSON.stringify(allSongs, null, 2), 'utf8');

      wx.hideLoading();
      wx.showModal({
        title: '导出完成 🎉',
        content: `共 ${allSongs.length} 首曲谱，复制 ${copied} 个文件${failed.length ? `，失败 ${failed.length} 个（已记入控制台）` : ''}。\n\n位置：${baseDir}\n\n开发者工具：设置 → 通用设置 → 文件位置，找到「用户数据目录」，进入 lyra-export 即可。`,
        showCancel: false,
        confirmText: '好的'
      });
      if (failed.length) console.warn('未能复制的本地路径：', failed);
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