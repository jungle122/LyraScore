// 已从云端迁移到本机，改读写本地数据层
const localStore = require('../../utils/localStore.js');

Page({
  data: {
    id: null, // 歌曲的唯一标识 (时间戳)
    _id: null, // ✨ 云数据库的记录 ID (用于更新操作)
    type: 'blank', 
    title: '',
    artist: '',
    comment: '', // ✨ 新增备注变量
    instrument: '吉他',
    style: '弹唱',
    status: 'practicing',

    // 自制谱数据
    key: 'C', originalKey: 'C', capo: 0, timeSignature: '4/4', bpm: 90, tuning: '标准',
    content: '',
    placeholderText: "G Em C D \n池塘边的榕树上...",

    // 纸质谱数据
    location: '',

    // 图片谱数据
    imagePaths: [],
    filePaths: [],
  },

  onLoad(options) {
    if (options.id) {
      this.loadSongFromCloud(Number(options.id));
    } else if (options.type) {
      // 新建模式
      this.setData({ type: options.type });
      this.setNavTitle(options.type);
    }
  },

  // --- ✨ 核心逻辑 1：从云端读取旧数据 ---
  loadSongFromCloud(id) {
    // 按 id (时间戳) 从本地查
    const song = localStore.getSongById(id);
    if (song) {
      // 兼容旧数据的图片格式
      let paths = [];
      if (song.imagePaths) paths = song.imagePaths;
      else if (song.imagePath) paths = [song.imagePath];

      this.setData({
        id: song.id,
        _id: song._id, // ✨ 记下这个身份证，保存时要用
        type: song.type,
        title: song.title,
        artist: song.artist || '',
        key: song.key, originalKey: song.originalKey, capo: song.capo,
        timeSignature: song.timeSignature, bpm: song.bpm, tuning: song.tuning,
        content: song.content,
        location: song.location,
        imagePaths: paths,
        filePaths: song.filePaths || [],
        comment: song.comment || '',
        instrument: song.instrument || '吉他', // 如果没有 instrument 字段，默认设为 '吉他'
        style: song.style || '弹唱', // 如果没有 style 字段，默认设为 '弹唱'
        status: song.status || 'practicing'
      });
      wx.setNavigationBarTitle({ title: '编辑乐谱' });
    } else {
      wx.showToast({ title: '未找到曲谱', icon: 'none' });
    }
  },

  setNavTitle(type) {
    let titleText = '新建乐谱';
    if (type === 'blank') titleText = '新建自制谱';
    if (type === 'paper') titleText = '纸质谱归档';
    if (type === 'image') titleText = '导入图片谱';
    wx.setNavigationBarTitle({ title: titleText });
  },

  onInstrumentChange(e) {
    this.setData({ instrument: e.detail.value });
  },

  onStyleChange(e) {
    this.setData({ style: e.detail.value });
  },

  onStatusChange(e) {
    this.setData({ status: e.detail.value });
  },

  // --- 图片选择逻辑 (和之前一样) ---
  chooseImage() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newFiles = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ imagePaths: this.data.imagePaths.concat(newFiles) });
      }
    });
  },

  chooseFromChat() {
    wx.showActionSheet({
      itemList: ['聊天图片', '聊天文件(PDF)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseChatImages();
        } else if (res.tapIndex === 1) {
          this.chooseChatFiles();
        }
      }
    });
  },

  chooseChatImages() {
    wx.chooseMessageFile({
      count: 9,
      type: 'image',
      extension: ['jpg', 'jpeg', 'png'],
      success: (res) => {
        const newFiles = res.tempFiles.map(f => f.path);
        this.setData({ imagePaths: this.data.imagePaths.concat(newFiles) });
      }
    });
  },

  chooseChatFiles() {
    wx.chooseMessageFile({
      count: 9,
      type: 'file',
      extension: ['pdf'],
      success: (res) => {
        const newFiles = res.tempFiles.map(f => f.path);
        this.setData({ filePaths: this.data.filePaths.concat(newFiles) });
      }
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const newPaths = this.data.imagePaths;
    newPaths.splice(index, 1);
    this.setData({ imagePaths: newPaths });
  },

  removeFile(e) {
    const index = e.currentTarget.dataset.index;
    const newPaths = this.data.filePaths;
    newPaths.splice(index, 1);
    this.setData({ filePaths: newPaths });
  },

  previewCurrent(e) {
    const currentUrl = e.currentTarget.dataset.url;
    wx.previewImage({ current: currentUrl, urls: this.data.imagePaths });
  },

  previewFile(e) {
    const path = e.currentTarget.dataset.path;
    wx.openDocument({ filePath: path });
  },

  // --- ✨ 核心逻辑 2：保存 (上传图片 + 写入数据库) ---
  async save() {
    // 1. 基础校验
    if (!this.data.title) {
      wx.showToast({ title: '请填写歌名', icon: 'none' });
      return;
    }
    // 只有在【纯图片谱模式】下才强制要求选图
    if (this.data.type === 'image' && this.data.imagePaths.length === 0 && this.data.filePaths.length === 0) {
      wx.showToast({ title: '请至少选一张图', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在保存...', mask: true });

    try {
      // 2. 处理图片/PDF：把新选的本地临时文件复制进持久目录
      //    （已经在本地持久目录里的，原样保留，不重复复制）
      const finalImagePaths = this.saveImagesLocally();
      const finalFilePaths = this.saveFilesLocally();

      // 3. 准备数据对象
      const songData = {
        id: this.data.id || Date.now(), // 保持时间戳 ID 用于逻辑兼容
        type: this.data.type,
        title: this.data.title,
        artist: this.data.artist,
        createTime: new Date().toLocaleDateString(),
        updateTime: Date.now(), // 记录最后更新时间
        // 如果是新建，默认 practicing；如果是编辑，不覆盖原状态
        // 这里我们在 update 时会特殊处理，add 时默认 practicing
        
        key: this.data.key, originalKey: this.data.originalKey, 
        capo: this.data.capo, timeSignature: this.data.timeSignature, 
        bpm: this.data.bpm, tuning: this.data.tuning,
        content: this.data.content,
        location: this.data.location,
        imagePaths: finalImagePaths, // ✨ 本地文件路径
        filePaths: finalFilePaths,
        comment: this.data.comment,
        instrument: this.data.instrument, // 存储乐器类型
        style: this.data.style // 存储风格类型
      };

      // 4. 写入本地
      if (this.data._id) {
        // --- 更新模式 (Update) ---
        // 注意：不要把 status 覆盖回 practicing，保持原样
        localStore.updateSong(this.data._id, songData);
      } else {
        // --- 新建模式 (Add) ---
        songData.status = this.data.status || 'practicing';
        localStore.addSong(songData);
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      // 延迟返回，确保 toast 能被看到
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  // --- 🛠️ 工具函数：把图片落到本地持久目录 ---
  saveImagesLocally() {
    return this.data.imagePaths.map(path => {
      // 已经在本地持久目录、或仍是旧云端路径的，原样保留
      if (path.indexOf(localStore.FILES_DIR) === 0 || path.startsWith('cloud://')) {
        return path;
      }
      // 新选的临时文件，复制进本地目录
      return localStore.saveTempFile(path, 'png');
    });
  },

  saveFilesLocally() {
    return this.data.filePaths.map(path => {
      if (path.indexOf(localStore.FILES_DIR) === 0 || path.startsWith('cloud://')) {
        return path;
      }
      const ext = path.split('.').pop() || 'pdf';
      return localStore.saveTempFile(path, ext);
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