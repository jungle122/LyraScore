Page({
  data: {
    song: null,
    showDrawer: false,
    fontSize: 36,
    
    // 节拍器
    isPlaying: false,
    currentBpm: 90,
    timer: null,
    
    // WebAudio 引擎
    audioCtx: null,
    tickBuffer: null
  },

  onLoad(options) {
    const id = Number(options.id);
    const allSongs = wx.getStorageSync('my_songs') || [];
    const targetSong = allSongs.find(s => s.id === id);

    if (targetSong) {
      this.setData({ 
        song: targetSong,
        currentBpm: targetSong.bpm || 90 
      });
      wx.setNavigationBarTitle({ title: targetSong.title });
    }

    // 初始化引擎
    this.data.audioCtx = wx.createWebAudioContext();
    this.loadTickSound();
  },

  onUnload() {
    this.stopMetronome();
    if(this.data.audioCtx) this.data.audioCtx.suspend();
  },

  loadTickSound() {
    const fs = wx.getFileSystemManager();
    const filePath = '/images/tick.mp3'; // 确保路径正确
    fs.readFile({
      filePath: filePath,
      success: (res) => {
        this.data.audioCtx.decodeAudioData(res.data, (buffer) => {
          this.data.tickBuffer = buffer;
        }, console.error);
      }
    });
  },

  // --- 菜单与功能 ---
  openDrawer() { this.setData({ showDrawer: true }); },
  closeDrawer() { this.setData({ showDrawer: false }); },
  onZoomChange(e) { this.setData({ fontSize: e.detail.value }); },

  // --- 节拍器控制 ---
  toggleMetronome(e) {
    const isOn = e.detail.value;
    this.setData({ isPlaying: isOn });

    if (isOn) {
      if (!this.data.tickBuffer) {
        wx.showToast({ title: '加载中...', icon: 'none' });
        // 稍微延迟一下等加载
        setTimeout(() => this.startMetronome(), 500);
      } else {
        this.startMetronome();
      }
    } else {
      this.stopMetronome();
    }
  },

  changeBpm(e) {
    this.setData({ currentBpm: e.detail.value });
    if (this.data.isPlaying) this.startMetronome();
  },

  onBpmInput(e) {
    let bpm = parseInt(e.detail.value);
    if (isNaN(bpm)) return;
    if (bpm > 250) bpm = 250;
    this.setData({ currentBpm: bpm });
    if (this.data.isPlaying && bpm >= 30) this.startMetronome();
  },

  startMetronome() {
    this.stopMetronome();
    
    if (this.data.audioCtx.state === 'suspended') {
      this.data.audioCtx.resume();
    }

    const interval = 60000 / this.data.currentBpm;
    
    this.playTick(); // 第一声

    this.data.timer = setInterval(() => {
      this.playTick();
    }, interval);
  },

  stopMetronome() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.data.timer = null;
    }
  },

  // ✨ WebAudio 播放逻辑
  playTick() {
    if (!this.data.tickBuffer) return;

    const source = this.data.audioCtx.createBufferSource();
    source.buffer = this.data.tickBuffer;
    // 阅读页不需要强弱拍区分，统一用原速
    source.playbackRate.value = 1.0; 
    source.connect(this.data.audioCtx.destination);
    source.start();
  },

  // --- 其他业务逻辑 (保持不变) ---
  goToEdit() {
    this.closeDrawer();
    wx.navigateTo({ url: `/pages/editor/editor?id=${this.data.song.id}` });
  },
  markAsPracticing() {
    this.updateStatus('practicing');
    wx.showToast({ title: '已移回', icon: 'success' });
    setTimeout(() => { wx.navigateBack(); }, 1000);
  },
  markAsFinished() {
    this.updateStatus('finished');
    wx.showToast({ title: '太棒了！🎉', icon: 'success' });
    setTimeout(() => { wx.navigateBack(); }, 1000);
  },
  deleteSong() {
    wx.showModal({
      title: '确认删除',
      content: `确定要删除《${this.data.song.title}》吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateStatus('deleted');
          wx.navigateBack();
        }
      }
    });
  },
  updateStatus(newStatus) {
    let allSongs = wx.getStorageSync('my_songs') || [];
    const id = this.data.song.id;
    const updatedSongs = allSongs.map(s => {
      if (s.id === id) {
        if (newStatus === 'deleted') s.deleteDate = Date.now();
        return Object.assign({}, s, { status: newStatus });
      }
      return s;
    });
    wx.setStorageSync('my_songs', updatedSongs);
  },
  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    wx.previewImage({ current: current, urls: this.data.song.imagePaths });
  },
  saveImage() { wx.showToast({ title: '功能开发中', icon: 'none' }); }
});