App({
  onLaunch() {
    // 已全面改为本地存储（wx.setStorage + 文件系统），不再初始化云开发。
    this.globalData = {};
  },
  globalShare() {
    return {
      title: 'Lyra吉他谱本 - 你的私人云端琴房 🎸',
      path: '/pages/practicing/practicing', // ✨ 关键：无论在哪分享，路径都指向首页
      imageUrl: '/images/icon.png' // 你可以用那个粉色的 Logo 图当封面
    }
  }
});