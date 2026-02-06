Page({
  data: {
    bpm: 90,
    isPlaying: false,
    
    timeSignatures: [
      { name: '4/4', beats: 4 },
      { name: '3/4', beats: 3 },
      { name: '2/4', beats: 2 },
      { name: '6/8', beats: 6 }
    ],
    tsIndex: 0,
    currentBeat: 0,
    timer: null,
    
    // ✨ WebAudio 引擎
    audioCtx: null,
    tickBuffer: null // 用来存解码后的声音数据
  },

  onLoad() {
    // ✨ 强行开启“无视静音模式”
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        mixWithOther: true,
      });
    }
    // 1. 创建引擎
    this.data.audioCtx = wx.createWebAudioContext();
    // 2. 预加载声音
    this.loadTickSound();
  },

  onUnload() {
    this.stop();
    // 页面关闭时清理引擎 (WebAudio 不用 destroy，让它自动回收即可，或者 suspend)
    if(this.data.audioCtx) this.data.audioCtx.suspend();
  },

  // ✨ 核心：预加载逻辑
  loadTickSound() {
    const fs = wx.getFileSystemManager();
    // ⚠️ 请确认你的 tick.mp3 是在 images 还是 audio 文件夹
    // 之前我们放在 images 里，这里就写 /images/tick.mp3
    const filePath = '/audio/tick.mp3'; 

    fs.readFile({
      filePath: filePath,
      success: (res) => {
        this.data.audioCtx.decodeAudioData(res.data, (buffer) => {
          this.data.tickBuffer = buffer;
          console.log('节拍器声音加载完毕');
        }, (err) => {
          console.error('解码失败', err);
        });
      },
      fail: (err) => {
        console.error('读取文件失败', err);
      }
    });
  },

  // --- 播放控制 ---
  togglePlay() {
    if (this.data.isPlaying) {
      this.stop();
    } else {
      // 如果声音还没加载好，提示一下
      if (!this.data.tickBuffer) {
        wx.showToast({ title: '音频加载中...', icon: 'none' });
        return;
      }
      this.start();
    }
  },

  start() {
    // 防止重复启动
    this.stop();
    
    this.setData({ isPlaying: true, currentBeat: 0 });
    
    // 确保引擎是运行状态 (iOS有时切后台会挂起)
    if (this.data.audioCtx.state === 'suspended') {
      this.data.audioCtx.resume();
    }

    const interval = 60000 / this.data.bpm;
    
    // 立即响第一声
    this.playTick();
    
    this.data.timer = setInterval(() => {
      this.playTick();
    }, interval);
  },

  stop() {
    if (this.data.timer) clearInterval(this.data.timer);
    this.setData({ 
      isPlaying: false, 
      currentBeat: 0, 
      timer: null 
    });
  },

  // ✨ 核心：机关枪发射逻辑
  playTick() {
    const beatsPerBar = this.data.timeSignatures[this.data.tsIndex].beats;
    let nextBeat = this.data.currentBeat + 1;
    if (nextBeat > beatsPerBar) nextBeat = 1;
    this.setData({ currentBeat: nextBeat });

    // 1. 创建一次性音源
    const source = this.data.audioCtx.createBufferSource();
    source.buffer = this.data.tickBuffer;
    
    // 2. 强弱拍变调 (原生支持！)
    if (nextBeat === 1) {
      source.playbackRate.value = 1.5; // 强拍：叮！
    } else {
      source.playbackRate.value = 1.0; // 弱拍：嗒
    }

    // 3. 连接并播放
    source.connect(this.data.audioCtx.destination);
    source.start();
  },

  // --- 其他交互逻辑 (保持不变) ---
  increaseBpm() { this.changeBpm(1); },
  decreaseBpm() { this.changeBpm(-1); },
  
  changeBpm(delta) {
    let newBpm = this.data.bpm + delta;
    if (newBpm < 30) newBpm = 30;
    if (newBpm > 250) newBpm = 250;
    
    this.setData({ bpm: newBpm });
    if (this.data.isPlaying) {
      this.start(); // start 内部会自动调用 stop
    }
  },

  onBpmInput(e) {
    let val = parseInt(e.detail.value);
    if (isNaN(val)) return;
    if (val > 250) val = 250;
    this.setData({ bpm: val });
    if (this.data.isPlaying && val >= 30) {
      this.start();
    }
  },

  onBpmBlur(e) {
    let val = parseInt(e.detail.value);
    if (isNaN(val) || val < 30) {
      val = 30;
      this.setData({ bpm: 30 });
      if (this.data.isPlaying) this.start();
    }
  },

  switchTimeSignature() {
    let nextIndex = (this.data.tsIndex + 1) % this.data.timeSignatures.length;
    this.setData({ tsIndex: nextIndex });
    if (this.data.isPlaying) {
      this.start();
    }
  },
  // 分享给朋友
  onShareAppMessage() {
    return app.globalShare();
  },

  // 分享到朋友圈
  onShareTimeline() {
    // 朋友圈模版通常只需要一个标题
    return {
      title: 'Lyra吉他谱本 - 吉他手的私人云端琴房'
    }
  }
});