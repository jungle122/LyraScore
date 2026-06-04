// 已从云端迁移到本机，改读本地数据层
const localStore = require('../../utils/localStore.js');

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

    // keyword 为空时直接清空结果
    if (!val) {
      this.setData({ resultList: [] });
      return;
    }

    // 本地过滤：排除回收站 + 对 title / artist 做不区分大小写的包含匹配
    const lower = val.toLowerCase();
    const normalizedList = localStore.getAllSongs()
      .map(item => {
        const statusNormalized = normalizeStatus(item.status);
        return {
          ...item,
          statusNormalized,
          statusText: statusText(statusNormalized)
        };
      })
      .filter(item => {
        if (item.statusNormalized === 'deleted') return false;
        const title = String(item.title || '').toLowerCase();
        const artist = String(item.artist || '').toLowerCase();
        return title.includes(lower) || artist.includes(lower);
      });

    this.setData({ resultList: normalizedList });
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