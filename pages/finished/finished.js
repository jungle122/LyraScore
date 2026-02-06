// 1. 初始化云数据库
const db = wx.cloud.database();

Page({
  data: {
    songList: []
  },

  onShow() {
    this.loadFinishedSongs();
  },

  loadFinishedSongs() {
    wx.showLoading({ title: '加载中...' });

    // ✨ 核心修改：从云端获取状态为 'finished' 的歌
    db.collection('songs')
      .where({
        status: 'finished'
      })
      .get()
      .then(res => {
        console.log('已练完列表获取成功:', res.data);
        this.setData({
          songList: res.data
        });
        wx.hideLoading();
      })
      .catch(err => {
        console.error('云端获取失败:', err);
        wx.hideLoading();
      });
  },

  // 跳转到阅读页 (逻辑与“正在练”一致)
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reader/reader?id=${id}` });
  },
    // ✨ 跳转到搜索页
    goToSearch() {
      // 因为 search 已经不是 tabBar 页面了，所以用 navigateTo
      wx.navigateTo({
        url: '/pages/search/search'
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
      title: 'Lyra吉他谱本 - 吉他手的私人云端琴房'
    }
  }
});