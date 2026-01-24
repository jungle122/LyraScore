Page({
  data: {
    keyword: '',
    resultList: []
  },

  // 每次页面显示时，清空搜索框（或者你可以选择保留）
  onShow() {
    // this.setData({ keyword: '', resultList: [] });
  },

  // 核心逻辑：输入时触发
  onSearchInput(e) {
    const val = e.detail.value;
    this.setData({ keyword: val });

    if (!val) {
      this.setData({ resultList: [] });
      return;
    }

    // 1. 获取所有歌 (包括正在练、已练完、回收站)
    const allSongs = wx.getStorageSync('my_songs') || [];

    // 2. 过滤
    const lowerVal = val.toLowerCase(); // 转小写，实现不区分大小写
    const results = allSongs.filter(song => {
      const titleMatch = song.title && song.title.toLowerCase().includes(lowerVal);
      const artistMatch = song.artist && song.artist.toLowerCase().includes(lowerVal);
      return titleMatch || artistMatch;
    });

    this.setData({ resultList: results });
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      keyword: '',
      resultList: []
    });
  },

  // 跳转详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reader/reader?id=${id}` });
  }
});