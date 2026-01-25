const db = wx.cloud.database();

Page({
  data: {
    trashList: []
  },

  onShow() {
    this.loadTrashFromCloud();
  },

  loadTrashFromCloud() {
    wx.showLoading({ title: '加载中...' });
    db.collection('songs').where({
      status: 'deleted' // 只查回收站里的
    }).get().then(res => {
      wx.hideLoading();
      // 计算剩余天数 (逻辑不变)
      const list = res.data.map(song => {
        const diff = Date.now() - (song.deleteDate || Date.now());
        let daysLeft = 30 - Math.floor(diff / (24 * 60 * 60 * 1000));
        return { ...song, daysLeft: daysLeft < 0 ? 0 : daysLeft };
      });
      this.setData({ trashList: list });
    });
  },

  // 恢复歌曲
  recoverSong(e) {
    const _id = e.currentTarget.dataset.id; // 云开发用 _id
    db.collection('songs').doc(_id).update({
      data: { status: 'practicing', deleteDate: null }
    }).then(() => {
      wx.showToast({ title: '已恢复' });
      this.loadTrashFromCloud();
    });
  },

  // 彻底删除
  deleteForever(e) {
    const _id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '彻底销毁',
      content: '无法找回，确定吗？',
      success: (res) => {
        if (res.confirm) {
          db.collection('songs').doc(_id).remove().then(() => {
            wx.showToast({ title: '已销毁' });
            this.loadTrashFromCloud();
          });
        }
      }
    });
  }
});