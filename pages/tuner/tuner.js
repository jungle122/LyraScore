const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const BASE_STRINGS = [
  { id: 0, file: 'E2.mp3', baseIndex: 4 + 12*2 },
  { id: 1, file: 'A2.mp3', baseIndex: 9 + 12*2 },
  { id: 2, file: 'D3.mp3', baseIndex: 2 + 12*3 },
  { id: 3, file: 'G3.mp3', baseIndex: 7 + 12*3 },
  { id: 4, file: 'B3.mp3', baseIndex: 11 + 12*3},
  { id: 5, file: 'E4.mp3', baseIndex: 4 + 12*4 }
];
const PRESETS = [
  { name: 'Standard', offsets: [0, 0, 0, 0, 0, 0] },
  { name: 'Drop D',   offsets: [-2, 0, 0, 0, 0, 0] },
  { name: 'Open D',   offsets: [-2, 0, 0, -1, -2, -2] },
  { name: 'Open G',   offsets: [-2, -2, 0, 0, 0, -2] },
  { name: 'DADGAD',   offsets: [-2, 0, 0, 0, -2, -2] }
];

Page({
  data: {
    presets: PRESETS,
    presetIndex: 0,
    globalOffset: 0,
    displayStrings: [],
    // WebAudio 上下文
    audioCtx: null, 
    // 用来缓存加载好的音频数据，避免每次点击都重新读文件，减少卡顿
    audioBuffers: {} 
  },

  onLoad() {
    // 1. 创建 WebAudio 上下文
    this.data.audioCtx = wx.createWebAudioContext();
    this.calculateStrings();
    
    // 2. 预加载所有音频文件到内存 (解决延迟问题的关键)
    this.preloadAudioFiles();
  },

  // 预加载逻辑：把6个mp3文件读成二进制数据，解码成音频buffer
  preloadAudioFiles() {
    const fs = wx.getFileSystemManager();
    
    BASE_STRINGS.forEach(item => {
      const filePath = `/audio/${item.file}`; // 确保 audio 文件夹在根目录
      
      // 读取文件
      fs.readFile({
        filePath: filePath,
        success: (res) => {
          // 解码音频
          this.data.audioCtx.decodeAudioData(res.data, (buffer) => {
            // 存入缓存：key 是文件名，value 是解码好的声音数据
            this.data.audioBuffers[item.file] = buffer;
            console.log(`文件 ${item.file} 加载完毕`);
          }, (err) => {
            console.error(`解码失败 ${item.file}`, err);
          });
        },
        fail: (err) => {
          console.error(`读取失败 ${filePath}`, err);
        }
      });
    });
  },

  calculateStrings() {
    const currentPreset = PRESETS[this.data.presetIndex];
    const globalShift = this.data.globalOffset;

    const finalStrings = BASE_STRINGS.map((base, i) => {
      const totalOffset = currentPreset.offsets[i] + globalShift;
      let targetIndex = base.baseIndex + totalOffset;
      let noteName = NOTES[targetIndex % 12];
      
      // 计算倍速
      let playbackRate = Math.pow(2, totalOffset / 12);

      return { 
        ...base, 
        note: noteName, 
        rate: playbackRate, 
        isPlaying: false 
      };
    });

    this.setData({ displayStrings: finalStrings });
  },

  // ✨ 核心播放逻辑：使用 WebAudio SourceNode
  playString(e) {
    const index = e.currentTarget.dataset.index;
    const stringData = this.data.displayStrings[index];
    const buffer = this.data.audioBuffers[stringData.file];

    if (!buffer) {
      wx.showToast({ title: '音频加载中...', icon: 'none' });
      return;
    }

    // 1. 创建一个音频源 (SourceNode)
    // 这种源是“一次性”的，播放完自动销毁，非常轻量
    const source = this.data.audioCtx.createBufferSource();
    
    // 2. 填入音频数据
    source.buffer = buffer;
    
    // 3. ✨ 设置倍速 (detune 是微调，playbackRate 是倍速)
    // WebAudio 的 playbackRate 在 iOS 上是完美支持的！
    source.playbackRate.value = stringData.rate;

    // 4. 连接到扬声器
    source.connect(this.data.audioCtx.destination);

    // 5. 播放
    source.start();

    // 动画反馈
    const key = `displayStrings[${index}].isPlaying`;
    this.setData({ [key]: true });
    setTimeout(() => { this.setData({ [key]: false }); }, 500);
  },

  onPresetChange(e) {
    this.setData({ presetIndex: e.detail.value });
    this.calculateStrings();
  },

  onGlobalChange(e) {
    this.setData({ globalOffset: e.detail.value });
    this.calculateStrings();
  }
});