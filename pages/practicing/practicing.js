Page({
  data: {
    songList: []
  },

  onShow() {
    this.loadSongs();
  },

  loadSongs() {
    const allSongs = wx.getStorageSync('my_songs') || [];
    // 只显示正在练的
    const practicingSongs = allSongs.filter(s => !s.status || s.status === 'practicing');
    this.setData({ songList: practicingSongs });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reader/reader?id=${id}` });
  }
});