App({
  onLaunch() {
    // ☁️ 云开发初始化
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // ✨ 这里填的是你刚才截图里的环境 ID
        env: 'cloud1-7g5nccia452995bc', 
        traceUser: true, // 记录用户访问日志
      });
      console.log("☁️ LyraScore 云开发环境初始化成功！");
    }
    
    // 这里依然保留，防止还没迁移数据时报错
    this.globalData = {};
  }
});