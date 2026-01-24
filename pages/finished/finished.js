Page({
  data: {
    songList: []
  },

  // 同样用 onShow，保证每次切换到这个页面都能刷新
  onShow() {
    this.loadSongs();
  },

  loadSongs() {
    const allSongs = wx.getStorageSync('my_songs') || [];
    
    // ✨ 核心区别：只筛选出 status === 'finished' 的歌
    const finishedSongs = allSongs.filter(s => s.status === 'finished');
    
    console.log("已练完列表读取到的歌单：", finishedSongs);

    this.setData({
      songList: finishedSongs
    });
  },

  // ✨ 代码复用：这个跳转逻辑和“正在练”页面一模一样
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reader/reader?id=${id}` });
  }
});