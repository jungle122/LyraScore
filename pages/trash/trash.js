// 已从云端迁移到本机，改读写本地数据层
const localStore = require('../../utils/localStore.js');

Page({
  data: {
    trashList: []
  },

  onShow() {
    this.loadTrashFromCloud();
  },

  loadTrashFromCloud() {
    // 计算剩余天数 (逻辑不变)
    const list = localStore.getAllSongs()
      .filter(song => song.status === 'deleted')
      .map(song => {
        const diff = Date.now() - (song.deleteDate || Date.now());
        let daysLeft = 30 - Math.floor(diff / (24 * 60 * 60 * 1000));
        return { ...song, daysLeft: daysLeft < 0 ? 0 : daysLeft };
      });
    this.setData({ trashList: list });
  },

  // 恢复歌曲
  recoverSong(e) {
    const _id = e.currentTarget.dataset.id;
    localStore.updateSong(_id, { status: 'practicing', deleteDate: null });
    wx.showToast({ title: '已恢复' });
    this.loadTrashFromCloud();
  },

  // 彻底删除（连带删掉本地图片/PDF 文件）
  deleteForever(e) {
    const _id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '彻底销毁',
      content: '无法找回，确定吗？',
      success: (res) => {
        if (res.confirm) {
          localStore.removeSong(_id);
          wx.showToast({ title: '已销毁' });
          this.loadTrashFromCloud();
        }
      }
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
      title: 'Lyra吉他谱本 - 吉他手的私人云端琴房',
      imageUrl: '/images/icon.png'
    }
  }
});