const db = wx.cloud.database();
const _ = db.command;

function normalizeStatus(status) {
  if (!status) return 'practicing';

  const value = String(status).toLowerCase().trim();
  if (
    value === 'practicing' ||
    value === 'practising' ||
    value === 'in_progress' ||
    value === 'ongoing' ||
    value === '正在练' ||
    value === '练习中'
  ) {
    return 'practicing';
  }

  if (
    value === 'finished' ||
    value === 'completed' ||
    value === 'done' ||
    value === '已练完' ||
    value === '已完成'
  ) {
    return 'finished';
  }

  if (value === 'deleted' || value === 'trash' || value === '已删除') {
    return 'deleted';
  }

  return 'practicing';
}

function statusText(status) {
  if (status === 'finished') return '✅ 已练完';
  if (status === 'deleted') return '🗑️ 回收站';
  return '🔥 正在练';
}

Page({
  data: {
    keyword: '',
    resultList: []
  },

  onSearchInput(e) {
    const val = e.detail.value;
    this.setData({ keyword: val });

    // 性能优化：keyword 为空时直接清空结果，不请求数据库
    if (!val) {
      this.setData({ resultList: [] });
      return;
    }

    // ✨ 核心逻辑：排除回收站 + 双字段模糊搜索
    db.collection('songs').where({
      // 条件1：排除已删除的记录（status !== 'deleted'）
      status: _.neq('deleted'),
      // 条件2：同时对 title 和 artist 进行包含匹配（$or 逻辑）
      $or: [
        {
          title: db.RegExp({
            regexp: val,
            options: 'i',  // 不区分大小写
          })
        },
        {
          artist: db.RegExp({
            regexp: val,
            options: 'i',  // 不区分大小写
          })
        }
      ]
    }).get().then(res => {
      const normalizedList = res.data
        .map(item => {
          const statusNormalized = normalizeStatus(item.status);
          return {
            ...item,
            statusNormalized,
            statusText: statusText(statusNormalized)
          };
        })
        .filter(item => item.statusNormalized !== 'deleted');

      this.setData({
        resultList: normalizedList
      });
    }).catch(err => {
      console.error('搜索失败:', err);
      wx.showToast({ title: '搜索失败', icon: 'none' });
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
      title: 'Lyra吉他谱本 - 吉他手的私人云端琴房',
      imageUrl: '/images/icon.png'
    }
  }
});