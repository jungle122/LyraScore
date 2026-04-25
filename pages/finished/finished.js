// 1. 初始化云数据库
const db = wx.cloud.database();
const PAGE_SIZE = 100;

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
    this.loadFinishedSongs();
  },

  fetchAllByQuery(query, skip = 0, list = []) {
    return query
      .skip(skip)
      .limit(PAGE_SIZE)
      .get()
      .then(res => {
        const merged = list.concat(res.data);
        if (res.data.length < PAGE_SIZE) {
          return merged;
        }
        return this.fetchAllByQuery(query, skip + PAGE_SIZE, merged);
      });
  },

  loadFinishedSongs() {
    wx.showLoading({ title: '加载中...' });

    const query = db.collection('songs').orderBy('_id', 'asc');

    this.fetchAllByQuery(query)
      .then(allRows => {
        let finishedSongs = allRows.filter(item => {
          const status = normalizeStatus(item.status);
          if (status === 'deleted' || status !== 'finished') return false;

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

        // 在前端做排序，避免云端排序字段缺失导致的不稳定行为
        if (this.data.selectedSort === 'newest') {
          finishedSongs.sort((a, b) => toSortableNumber(b.id) - toSortableNumber(a.id));
        } else if (this.data.selectedSort === 'oldest') {
          finishedSongs.sort((a, b) => toSortableNumber(a.id) - toSortableNumber(b.id));
        } else if (this.data.selectedSort === 'name') {
          finishedSongs.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN'));
        }

        console.log('已练完列表获取成功:', finishedSongs);
        this.setData({
          songList: finishedSongs
        });
        wx.hideLoading();
      })
      .catch(err => {
        console.error('云端获取失败:', err);
        wx.hideLoading();
      });
  },

  onFilterChange(e) {
    const selectedInstrument = e.currentTarget.dataset.value;
    this.setData({ selectedInstrument });
    this.loadFinishedSongs();
  },

  onStyleChange(e) {
    const selectedStyle = e.currentTarget.dataset.value;
    this.setData({ selectedStyle });
    this.loadFinishedSongs();
  },

  onSortChange(e) {
    const selectedSort = e.currentTarget.dataset.value;
    this.setData({ selectedSort });
    this.loadFinishedSongs();
  },

  // 跳转到阅读页 (逻辑与“正在练”一致)
  goToDetail(e) {
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
      await Promise.all(this.data.selectedIds.map(id =>
        db.collection('songs').doc(id).update({
          data: { status: 'deleted', deleteDate: Date.now() }
        })
      ));
      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ isEditMode: false, selectedIds: [] });
      this.loadFinishedSongs();
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
      await Promise.all(this.data.selectedIds.map(id =>
        db.collection('songs').doc(id).update({
          data: { status: 'practicing', deleteDate: null }
        })
      ));
      wx.showToast({ title: '已移动', icon: 'success' });
      this.setData({ isEditMode: false, selectedIds: [] });
      this.loadFinishedSongs();
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