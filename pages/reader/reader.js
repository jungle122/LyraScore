const db = wx.cloud.database();

Page({
  data: {
    song: null,
    showDrawer: false,
    fontSize: 36,
    initialY: 0, // ✨ 改名为 initialY，表示只负责初始位置
    
    // --- 节拍器数据 ---
    isPlaying: false,
    currentBpm: 90,
    timer: null,
    
    // --- WebAudio 引擎核心 ---
    audioCtx: null,
    tickBuffer: null // 用来存解码后的声音数据
  },

  onLoad(options) {
    const id = Number(options.id);
    
    // 1. 加载歌曲信息
    this.loadSongFromCloud(id);

    // 2. 初始化音频引擎 (iOS 防静音配置)
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false, // 强行响铃
        mixWithOther: true     // 允许混音
      });
    }
    
    // 3. 创建 WebAudio 上下文并预加载声音
    this.data.audioCtx = wx.createWebAudioContext();
    this.loadTickSound();
  },

  onUnload() {
    this.stopMetronome();
    // 挂起音频引擎，节省资源
    if (this.data.audioCtx) this.data.audioCtx.suspend();
  },

  // --- ✨ 核心修复：WebAudio 预加载逻辑 ---
  loadTickSound() {
    const fs = wx.getFileSystemManager();
    // 确保你的 tick.mp3 路径正确 (在 audio 文件夹里)
    const filePath = '/audio/tick.mp3'; 

    fs.readFile({
      filePath: filePath,
      success: (res) => {
        // 解码音频文件
        this.data.audioCtx.decodeAudioData(res.data, (buffer) => {
          this.data.tickBuffer = buffer;
          console.log('阅读页节拍器加载完毕');
        }, (err) => {
          console.error('音频解码失败', err);
        });
      },
      fail: (err) => {
        console.error('读取音频文件失败', err);
      }
    });
  },

  // --- ✨ 核心修复：WebAudio 播放逻辑 (机关枪模式) ---
  playTick() {
    if (!this.data.tickBuffer) return;

    // 1. 创建一次性音源
    const source = this.data.audioCtx.createBufferSource();
    source.buffer = this.data.tickBuffer;
    
    // 阅读页统一用原速 (不需要强弱拍区分，简单点)
    source.playbackRate.value = 1.0; 

    // 2. 连接并播放
    source.connect(this.data.audioCtx.destination);
    source.start();
  },

  // --- 节拍器控制 ---
  
  toggleMetronome(e) {
    const isOn = e.detail.value;
    this.setData({ isPlaying: isOn });

    if (isOn) {
      // 如果声音还没加载完
      if (!this.data.tickBuffer) {
        wx.showToast({ title: '音频加载中...', icon: 'none' });
        // 延迟 500ms 重试
        setTimeout(() => {
          if (this.data.isPlaying) this.startMetronome();
        }, 500);
      } else {
        this.startMetronome();
      }
    } else {
      this.stopMetronome();
    }
  },

  startMetronome() {
    this.stopMetronome(); // 先清空旧定时器
    
    // 唤醒引擎 (iOS 必须)
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

  // 滑块改变 BPM
  changeBpm(e) {
    this.setData({ currentBpm: e.detail.value });
    if (this.data.isPlaying) this.startMetronome();
  },

  // 输入框改变 BPM
  onBpmInput(e) {
    let bpm = parseInt(e.detail.value);
    if (isNaN(bpm)) return;
    if (bpm > 250) bpm = 250;
    
    this.setData({ currentBpm: bpm });
    
    // 只有在合理范围内才实时更新
    if (this.data.isPlaying && bpm >= 30) {
      this.startMetronome();
    }
  },

  // --- 业务逻辑：加载歌曲 ---
  loadSongFromCloud(id) {
    wx.showLoading({ title: '加载中...' });
    db.collection('songs').where({ id: id }).get().then(res => {
      wx.hideLoading();
      if (res.data.length > 0) {
        const targetSong = res.data[0];
        // 兼容图片数组
        if (!targetSong.imagePaths && targetSong.imagePath) {
          targetSong.imagePaths = [targetSong.imagePath];
        }
        this.setData({
          song: targetSong,
          currentBpm: targetSong.bpm || 90,
          initialY: targetSong.rulerY || 0 // 默认在最上面
        });
        wx.setNavigationBarTitle({ title: targetSong.title });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
    });
  },

  // --- 业务逻辑：菜单与状态 ---
  openDrawer() { this.setData({ showDrawer: true }); },
  closeDrawer() { this.setData({ showDrawer: false }); },
  onZoomChange(e) { this.setData({ fontSize: e.detail.value }); },

  goToEdit() {
    this.closeDrawer();
    wx.navigateTo({ url: `/pages/editor/editor?id=${this.data.song.id}` });
  },

  markAsPracticing() {
    this.updateStatus('practicing', '已移回“正在练”');
  },

  markAsFinished() {
    this.updateStatus('finished', '太棒了！🎉');
  },

  deleteSong() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这首曲谱吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.updateStatus('deleted', '已移入回收站');
        }
      }
    });
  },

  updateStatus(newStatus, toastMsg) {
    db.collection('songs').doc(this.data.song._id).update({
      data: {
        status: newStatus,
        deleteDate: newStatus === 'deleted' ? Date.now() : null
      }
    }).then(() => {
      wx.showToast({ title: toastMsg, icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1200);
    });
  },

  // 图片全屏预览
  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    wx.previewImage({
      current: current,
      urls: this.data.song.imagePaths
    });
  },

  // ✨ 核心函数：记录红尺位置
  onRulerChange(e) {
    // 只有手动拖动(touch)引起的改变，我们才记录
    if (e.detail.source === 'touch') {
      const newY = e.detail.y;
      
      // 🛑 核心修复：这里绝对不要再写 this.setData({ initialY: newY })
      // 因为这会触发组件重新渲染，导致"重播"
      
      // 我们只需要执行保存逻辑即可
      this.saveRulerPosition(newY);
    }
  },

  saveRulerPosition(y) {
    db.collection('songs').doc(this.data.song._id).update({
      data: {
        rulerY: y
      }
    }).then(() => {
      console.log('进度已自动保存:', y);
    });
  },
  
  saveImage() { wx.showToast({ title: '功能开发中', icon: 'none' }); }
});