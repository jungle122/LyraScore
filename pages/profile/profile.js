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

  // 关于作者
  showAbout() {
    wx.showModal({
      title: '关于 Lyra吉他谱本',
      content: '由 Lyra 开发的私人吉他谱管理工具。\n 图标素材由 iconfont 设计师【落叶寄相思】提供。\n 联系作者：congconglinr@foxmail.com \n Version 2.0.0',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#FA7298' // 使用你的主题粉色
    });
  }
});