const db = wx.cloud.database(); // ✨ 初始化云数据库

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
    this.loadSongs();
  },

  loadSongs() {
    wx.showLoading({ title: '加载中...' });

    let whereCondition = { status: 'practicing' };

    // 乐器筛选条件
    if (this.data.selectedInstrument !== 'all') {
      const instrumentMap = {
        'guitar': '吉他',
        'ukulele': '尤克里里'
      };
      const instrumentValue = instrumentMap[this.data.selectedInstrument];
      whereCondition.instrument = instrumentValue;
    }

    // 风格筛选条件
    if (this.data.selectedStyle !== 'all') {
      const styleMap = {
        'fingerstyle': '弹唱',
        'picking': '指弹'
      };
      const styleValue = styleMap[this.data.selectedStyle];
      whereCondition.style = styleValue;
    }

    let query = db.collection('songs').where(whereCondition);

    // 排序条件
    if (this.data.selectedSort === 'newest') {
      query = query.orderBy('id', 'desc');
    } else if (this.data.selectedSort === 'oldest') {
      query = query.orderBy('id', 'asc');
    } else if (this.data.selectedSort === 'name') {
      query = query.orderBy('title', 'asc');
    }

    query.get()
      .then(res => {
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
      await Promise.all(this.data.selectedIds.map(id =>
        db.collection('songs').doc(id).update({
          data: { status: 'finished', deleteDate: null }
        })
      ));
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
      path: '/pages/practicing/practicing'
    }
  },

  // ✨ 2. 开启“分享到朋友圈”
  onShareTimeline() {
    return {
      title: 'Lyra吉他谱本：吉他手的私人云端琴房☁️',
      query: 'from=timeline'
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