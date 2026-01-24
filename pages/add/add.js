Page({
  // 以前这里全是复杂的弹窗逻辑，现在不需要了！
  // 页面显示就是显示，不需要自动做什么。

  // 1. 跳转到：新建自制谱
  goToBlank() {
    wx.navigateTo({
      url: '/pages/editor/editor?type=blank'
    });
  },

  // 2. 跳转到：图片谱导入
  goToImage() {
    wx.navigateTo({
      url: '/pages/editor/editor?type=image'
    });
  },

  // 3. 跳转到：纸质谱归档
  goToPaper() {
    wx.navigateTo({
      url: '/pages/editor/editor?type=paper'
    });
  }
});