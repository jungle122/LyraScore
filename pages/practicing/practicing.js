// 已从云端迁移到本机，改读写本地数据层，不再使用 wx.cloud.database()
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

function normalizeInstrument(value) {
  if (!value) return '';
  const text = String(value).toLowerCase().trim();
  if (text === '吉他' || text === 'guitar') return 'guitar';
  if (text === '尤克里里' || text === 'ukulele') return 'ukulele';
  return '';
}

function normalizeStyle(value) {
  if (!value) return '';
  const text = String(value).toLowerCase().trim();
  if (text === '弹唱' || text === 'fingerstyle') return 'fingerstyle';
  if (text === '指弹' || text === 'picking') return 'picking';
  return '';
}

function toSortableNumber(value) {
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

Page({
  data: {
    songList: [],
    selectedInstrument: 'all', // 筛选条件，默认显示全部
    selectedStyle: 'all', // 风格筛选条件，默认显示全部
    selectedSort: 'newest', // 排序条件，默认按最新存
    isEditMode: false,
    selectedIds: []
  },

  onShow() {
    this.setData({
      selectedInstrument: 'all',
      selectedStyle: 'all'
    });
    this.loadSongs();
  },

  loadSongs() {
    const allRows = localStore.getAllSongs();
    let practicingSongs = allRows.filter(item => {
      const status = normalizeStatus(item.status);
      if (status === 'deleted' || status !== 'practicing') return false;

      if (this.data.selectedInstrument !== 'all') {
        const instrument = normalizeInstrument(item.instrument);
        if (instrument !== this.data.selectedInstrument) return false;
      }

      if (this.data.selectedStyle !== 'all') {
        const style = normalizeStyle(item.style);
        if (style !== this.data.selectedStyle) return false;
      }

      return true;
    });

    // 前端排序
    if (this.data.selectedSort === 'newest') {
      practicingSongs.sort((a, b) => toSortableNumber(b.id) - toSortableNumber(a.id));
    } else if (this.data.selectedSort === 'oldest') {
      practicingSongs.sort((a, b) => toSortableNumber(a.id) - toSortableNumber(b.id));
    } else if (this.data.selectedSort === 'name') {
      practicingSongs.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN'));
    }

    this.setData({ songList: practicingSongs });
  },

  // 跳转详情 (保持不变)
  goToDetail(e) {
    // ✨ 注意：云开发会自动给每条数据生成一个唯一的 '_id'
    // 我们以前用的是 'id' (时间戳)。为了兼容，这里我们先看看 item 里有没有 id
    // 如果是新录入的，我们以后尽量用 _id，但现在先不动这个逻辑
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reader/reader?id=${id}` });
  },
  
  toggleEditMode() {
    const nextMode = !this.data.isEditMode;
    this.setData({ isEditMode: nextMode, selectedIds: [] });
  },

  onCardTap(e) {
    if (this.data.isEditMode) {
      this.toggleSelectById(e.currentTarget.dataset.uid);
      return;
    }

    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reader/reader?id=${id}` });
  },

  toggleSelectItem(e) {
    this.toggleSelectById(e.currentTarget.dataset.uid);
  },

  toggleSelectById(uid) {
    const selected = this.data.selectedIds.slice();
    const idx = selected.indexOf(uid);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(uid);
    }
    this.setData({ selectedIds: selected });
  },

  toggleSelectAll() {
    const isAllSelected = this.data.selectedIds.length > 0 && this.data.selectedIds.length === this.data.songList.length;
    if (isAllSelected) {
      this.setData({ selectedIds: [] });
    } else {
      const allIds = this.data.songList.map(item => item._id).filter(Boolean);
      this.setData({ selectedIds: allIds });
    }
  },

  async batchDelete() {
    if (this.data.selectedIds.length === 0) {
      wx.showToast({ title: '请先选择曲谱', icon: 'none' });
      return;
    }

    const res = await new Promise(resolve => {
      wx.showModal({
        title: '批量删除',
        content: `确定删除选中的 ${this.data.selectedIds.length} 首曲谱吗？`,
        confirmText: '删除',
        confirmColor: '#FA7298',
        success: resolve
      });
    });

    if (!res.confirm) return;

    wx.showLoading({ title: '处理中...' });
    try {
      this.data.selectedIds.forEach(id =>
        localStore.updateSong(id, { status: 'deleted', deleteDate: Date.now() })
      );
      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ isEditMode: false, selectedIds: [] });
      this.loadSongs();
    } catch (err) {
      console.error('批量删除失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async batchMove() {
    if (this.data.selectedIds.length === 0) {
      wx.showToast({ title: '请先选择曲谱', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '处理中...' });
    try {
      this.data.selectedIds.forEach(id =>
        localStore.updateSong(id, { status: 'finished', deleteDate: null })
      );
      wx.showToast({ title: '已移动', icon: 'success' });
      this.setData({ isEditMode: false, selectedIds: [] });
      this.loadSongs();
    } catch (err) {
      console.error('批量移动失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
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
      path: '/pages/practicing/practicing',
      imageUrl: '/images/icon.png'
    }
  },

  // ✨ 2. 开启“分享到朋友圈”
  onShareTimeline() {
    return {
      title: 'Lyra吉他谱本：吉他手的私人云端琴房☁️',
      query: 'from=timeline',
      imageUrl: '/images/icon.png'
    }
  },

  onFilterChange(e) {
    const selectedInstrument = e.currentTarget.dataset.value;
    this.setData({ selectedInstrument });
    this.loadSongs();
  },

  onStyleChange(e) {
    const selectedStyle = e.currentTarget.dataset.value;
    this.setData({ selectedStyle });
    this.loadSongs();
  },

  onSortChange(e) {
    const selectedSort = e.currentTarget.dataset.value;
    this.setData({ selectedSort });
    this.loadSongs();
  },
});