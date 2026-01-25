// 1. 初始化云数据库
const db = wx.cloud.database();

Page({
  data: {
    song: null,
    showDrawer: false,
    fontSize: 36,
    isPlaying: false,
    currentBpm: 90,
    timer: null,
    audioCtx: null,
    tickBuffer: null
  },

  onLoad(options) {
    // 2. 拿到传过来的 ID (这是我们存的时间戳 id)
    const id = Number(options.id);
    
    // ✨ 核心修改：从云端数据库获取歌曲详情
    this.loadSongFromCloud(id);
    // ✨ 强行开启“无视静音模式”
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        mixWithOther: true,
      });
    }
    this.data.audioCtx = wx.createWebAudioContext();
    this.loadTickSound();
  },

  // ✨ 新增：云端读取逻辑
  loadSongFromCloud(id) {
    wx.showLoading({ title: '加载中...' });
    
    db.collection('songs').where({
      id: id // 根据时间戳 ID 查询
    }).get().then(res => {
      wx.hideLoading();
      if (res.data.length > 0) {
        const targetSong = res.data[0];
        
        // 兼容处理旧数据图片格式
        if (!targetSong.imagePaths && targetSong.imagePath) {
          targetSong.imagePaths = [targetSong.imagePath];
        }

        this.setData({
          song: targetSong,
          currentBpm: targetSong.bpm || 90
        });
        wx.setNavigationBarTitle({ title: targetSong.title });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获取详情失败', err);
    });
  },

  // --- 节拍器与菜单逻辑 (保持 WebAudio 版不变) ---
  loadTickSound() {
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: '/images/tick.mp3',
      success: (res) => {
        this.data.audioCtx.decodeAudioData(res.data, (buffer) => {
          this.data.tickBuffer = buffer;
        });
      }
    });
  },

  playTick() {
    if (!this.data.tickBuffer) return;
    const source = this.data.audioCtx.createBufferSource();
    source.buffer = this.data.tickBuffer;
    source.connect(this.data.audioCtx.destination);
    source.start();
  },

  stopMetronome() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.data.timer = null;
    }
  },

  startMetronome() {
    this.stopMetronome();
    if (this.data.audioCtx.state === 'suspended') this.data.audioCtx.resume();
    const interval = 60000 / this.data.currentBpm;
    this.playTick();
    this.data.timer = setInterval(() => { this.playTick(); }, interval);
  },

  toggleMetronome(e) {
    const isOn = e.detail.value;
    this.setData({ isPlaying: isOn });
    if (isOn) this.startMetronome(); else this.stopMetronome();
  },

  onBpmInput(e) {
    let bpm = parseInt(e.detail.value);
    if (isNaN(bpm)) return;
    if (bpm > 250) bpm = 250;
    this.setData({ currentBpm: bpm });
    if (this.data.isPlaying && bpm >= 30) this.startMetronome();
  },

  // --- ✨ 修改：云端状态更新逻辑 ---

  // 1. 移回练习
  markAsPracticing() {
    this.updateStatusOnCloud('practicing', '已移回“正在练”');
  },

  // 2. 标记学会
  markAsFinished() {
    this.updateStatusOnCloud('finished', '太棒了！🎉');
  },

  // 3. 移入回收站
  deleteSong() {
    wx.showModal({
      title: '确认删除',
      content: `确定要删除《${this.data.song.title}》吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateStatusOnCloud('deleted', '已移入回收站');
        }
      }
    });
  },

  // ✨ 核心工具：更新云端数据库状态
  updateStatusOnCloud(newStatus, toastText) {
    wx.showLoading({ title: '处理中...' });
    
    // 使用 _id 进行精准更新
    db.collection('songs').doc(this.data.song._id).update({
      data: {
        status: newStatus,
        // 如果是删除，记录时间
        deleteDate: newStatus === 'deleted' ? Date.now() : null
      }
    }).then(res => {
      wx.hideLoading();
      wx.showToast({ title: toastText, icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1200);
    }).catch(err => {
      wx.hideLoading();
      console.error('更新失败', err);
      wx.showToast({ title: '同步失败', icon: 'none' });
    });
  },

  // --- 其他功能 ---
  onUnload() { this.stopMetronome(); if(this.data.audioCtx) this.data.audioCtx.suspend(); },
  openDrawer() { this.setData({ showDrawer: true }); },
  closeDrawer() { this.setData({ showDrawer: false }); },
  onZoomChange(e) { this.setData({ fontSize: e.detail.value }); },
  goToEdit() {
    this.closeDrawer();
    wx.navigateTo({ url: `/pages/editor/editor?id=${this.data.song.id}` });
  },
  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    wx.previewImage({ current: current, urls: this.data.song.imagePaths });
  }
});