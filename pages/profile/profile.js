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