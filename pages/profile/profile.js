Page({
  data: {
    counts: {
      practicing: 0,
      finished: 0,
      deleted: 0
    }
  },

  onShow() {
    this.calculateStats();
  },

  calculateStats() {
    const allSongs = wx.getStorageSync('my_songs') || [];
    
    // 分类统计
    const practicing = allSongs.filter(s => !s.status || s.status === 'practicing').length;
    const finished = allSongs.filter(s => s.status === 'finished').length;
    const deleted = allSongs.filter(s => s.status === 'deleted').length;

    this.setData({
      counts: {
        practicing,
        finished,
        deleted
      }
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
  // --- ✨ 真正的清理缓存：清除“僵尸图片” ---
  clearCache() {
    const fs = wx.getFileSystemManager();
    const USER_DATA_PATH = wx.env.USER_DATA_PATH;

    wx.showModal({
      title: '深度清理',
      content: '系统将扫描并删除所有不再使用的图片文件，确定执行吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在扫描...' });

          // 1. 获取“白名单”：所有正在使用的图片
          const allSongs = wx.getStorageSync('my_songs') || [];
          const usedImages = new Set(); // 用 Set 查找速度快
          
          allSongs.forEach(song => {
            // 如果有 imagePaths 数组，把里面的路径都加进去
            if (song.imagePaths && song.imagePaths.length > 0) {
              song.imagePaths.forEach(path => usedImages.add(path));
            }
            // 兼容旧数据
            if (song.imagePath) usedImages.add(song.imagePath);
          });

          // 2. 读取本地文件夹里的所有文件
          fs.readdir({
            dirPath: USER_DATA_PATH,
            success: (res) => {
              const files = res.files; // 获取文件名列表 ['score_1.png', 'score_2.png'...]
              let deleteCount = 0;
              let deleteSize = 0; // (可选) 以后可以统计删了多少KB

              // 3. 遍历文件，揪出僵尸
              files.forEach(fileName => {
                // 只处理我们要清理的目标（以 score_ 开头的图片）
                // 防止误删其他重要文件
                if (fileName.startsWith('score_') && (fileName.endsWith('.png') || fileName.endsWith('.jpg'))) {
                  
                  const fullPath = `${USER_DATA_PATH}/${fileName}`;
                  
                  // 4. 审判时刻：如果白名单里没有它，就删！
                  if (!usedImages.has(fullPath)) {
                    try {
                      fs.unlinkSync(fullPath); // 同步删除
                      deleteCount++;
                      console.log('已清理僵尸文件:', fileName);
                    } catch (e) {
                      console.error('删除失败:', fileName);
                    }
                  }
                }
              });

              wx.hideLoading();
              
              // 5. 反馈结果
              if (deleteCount > 0) {
                wx.showToast({ title: `清理了 ${deleteCount} 张图片`, icon: 'success' });
              } else {
                wx.showToast({ title: '暂无垃圾文件', icon: 'success' });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error(err);
              wx.showToast({ title: '读取文件失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // ... 后面的代码不变 ...

  // 关于作者
  showAbout() {
    wx.showModal({
      title: '关于 Lyra吉他谱本',
      content: '由 Lyra 开发的私人吉他谱管理工具。\n 图标素材由 iconfont 设计师【落叶寄相思】提供。\n 联系作者：congconglinr@foxmail.com \n Version 1.1.1',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#FA7298' // 使用你的主题粉色
    });
  }
});