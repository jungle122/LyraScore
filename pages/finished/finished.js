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
  }
});