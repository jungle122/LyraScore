const db = wx.cloud.database(); // ✨ 初始化云数据库

Page({
  data: {
    songList: []
  },

  onShow() {
    this.loadSongs();
  },

  loadSongs() {
    wx.showLoading({ title: '加载中...' });

    // ☁️ 云开发查询写法
    // collection('songs'): 找 'songs' 表
    // where(...): 筛选条件
    // get(): 执行查询
    db.collection('songs')
      .where({
        // 筛选逻辑：状态是 practicing (注意：云开发查询对空值比较严格，我们先只查明确标记为 practicing 的)
        // 如果你有很多旧数据没有 status 字段，它们可能暂时显示不出来，我们后续可以写个脚本批量刷一下
        status: 'practicing'
      })
      .get()
      .then(res => {
        // res.data 就是查出来的数组
        console.log('云端获取成功:', res.data);
        
        this.setData({
          songList: res.data
        });
        wx.hideLoading();
      })
      .catch(err => {
        console.error('云端获取失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  // 跳转详情 (保持不变)
  goToDetail(e) {
    // ✨ 注意：云开发会自动给每条数据生成一个唯一的 '_id'
    // 我们以前用的是 'id' (时间戳)。为了兼容，这里我们先看看 item 里有没有 id
    // 如果是新录入的，我们以后尽量用 _id，但现在先不动这个逻辑
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
    // ✨ 1. 开启“转发给好友”
  onShareAppMessage() {
    return {
      title: '我正在用 Lyra吉他谱本 练琴，太好用了！🎸',
      path: '/pages/practicing/practicing'
    }
  },

  // ✨ 2. 开启“分享到朋友圈”
  onShareTimeline() {
    return {
      title: 'Lyra吉他谱本：吉他手的私人云端琴房☁️',
      query: 'from=timeline'
    }
  }
});