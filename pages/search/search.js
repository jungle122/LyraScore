const db = wx.cloud.database();

Page({
  data: {
    keyword: '',
    resultList: []
  },

  onSearchInput(e) {
    const val = e.detail.value;
    this.setData({ keyword: val });

    if (!val) {
      this.setData({ resultList: [] });
      return;
    }

    // ✨ 云开发模糊搜索核心逻辑
    db.collection('songs').where({
      // 使用正则表达式进行模糊匹配
      // 'i' 表示不区分大小写
      title: db.RegExp({
        regexp: val,
        options: 'i',
      })
      // 注意：由于云数据库限制，单个查询很难同时模糊搜 title 或 artist
      // 这里的逻辑优先搜索标题，如果需要同时搜歌手，需要更高级的指令，咱们先保标题
    }).get().then(res => {
      this.setData({
        resultList: res.data
      });
    });
  },

  clearSearch() {
    this.setData({ keyword: '', resultList: [] });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reader/reader?id=${id}` });
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