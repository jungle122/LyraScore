// 初始化云数据库
const db = wx.cloud.database();
const library = require('../../utils/library');

Page(require('../../utils/theme').page({
  data: {
    id: null, // 歌曲的唯一标识 (时间戳)
    _id: null, // ✨ 云数据库的记录 ID (用于更新操作)
    type: 'image',
    title: '',
    artist: '',
    comment: '', // ✨ 新增备注变量
    instrument: '吉他',
    style: '弹唱',
    readOnly: false,
    key: 'C', originalKey: 'C', capo: 0, timeSignature: '4/4', bpm: 90, tuning: '标准',
    content: '',
    placeholderText: 'G Em C D\n在这里输入和弦、歌词或练习笔记…',

    // 纸质谱数据
    location: '',

    // 图片谱数据
    imagePaths: [],
    filePaths: [],
  },

  onLoad(options) {
    if (options.uid || options.id) {
      this.setData({readOnly:true});
      this.loadSongFromCloud(options);
    } else {
      const type=['blank','image','paper'].includes(options.type)?options.type:'image';
      this.setData({type});this.setNavTitle(type);
    }
  },

  // --- ✨ 核心逻辑 1：从云端读取旧数据 ---
  async loadSongFromCloud(options) {
    wx.showLoading({title:'加载中...'});
    try {
      const song=await library.getSong(options);
      if(!library.isActive(song)) {
        this.setData({readOnly:true});wx.showToast({title:'该曲谱不可编辑',icon:'none'});return;
      }
      this.setData({id:song.id || null,_id:song._id,type:song.type,title:song.title || '',artist:song.artist || '',
        location:song.location || '',imagePaths:song.imagePaths || (song.imagePath?[song.imagePath]:[]),filePaths:song.filePaths || [],
        comment:song.comment || '',instrument:song.instrument || '吉他',style:song.style || '弹唱',readOnly:false,
        key:song.key || 'C',originalKey:song.originalKey || 'C',capo:song.capo == null ? 0 : song.capo,
        timeSignature:song.timeSignature || '4/4',bpm:song.bpm || 90,tuning:song.tuning || '标准',content:song.content || ''});
      wx.setNavigationBarTitle({title:'编辑曲谱'});
    }catch(e){this.setData({readOnly:true});wx.showToast({title:library.errorText(e),icon:'none'});}
    finally{wx.hideLoading();}
  },

  setNavTitle(type) {
    let titleText = '新建乐谱';
    if (type === 'blank') titleText = '添加自制谱';
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

  async previewFile(e) {
    const path = e.currentTarget.dataset.path;
    let filePath = path;

    if (path.startsWith('cloud://')) {
      const res = await wx.cloud.downloadFile({ fileID: path });
      filePath = res.tempFilePath;
    }

    wx.openDocument({ filePath: filePath });
  },

  // --- ✨ 核心逻辑 2：保存 (上传图片 + 写入数据库) ---
  async save() {
    if (this.data.readOnly || this._saving) return;
    this._saving=true;
    // 1. 基础校验
    if (!this.data.title) {
      wx.showToast({ title: '请填写歌名', icon: 'none' });
      this._saving=false; return;
    }
    // 只有在【纯图片谱模式】下才强制要求选图
    if (this.data.type === 'image' && this.data.imagePaths.length === 0 && this.data.filePaths.length === 0) {
      wx.showToast({ title: '请至少选择图片或 PDF', icon: 'none' }); this._saving=false;
      return;
    }

    wx.showLoading({ title: '正在保存...', mask: true });

    try {
      // 2. 处理图片上传 (关键步骤！)
      // 只有那些还没上传的（不是 cloud:// 开头的）才需要上传
      const finalImagePaths = await this.uploadAllImages();
      const finalFilePaths = await this.uploadAllFiles();

      // 3. 准备数据对象
      const songData = {
        id: this.data.id || Date.now(), // 保持时间戳 ID 用于逻辑兼容
        type: this.data.type,
        title: this.data.title,
        artist: this.data.artist,
        updateTime: Date.now(), // 记录最后更新时间
        location: this.data.location,
        imagePaths: finalImagePaths, // ✨ 存入云端文件 ID
        filePaths: finalFilePaths,
        comment: this.data.comment, // ✨ 将备注存入云端
        instrument: this.data.instrument, // 存储乐器类型
        style: this.data.style // 存储风格类型
      };

      if (this.data.type === 'blank') {
        Object.assign(songData, {
          key:this.data.key, originalKey:this.data.originalKey, capo:this.data.capo,
          timeSignature:this.data.timeSignature, bpm:this.data.bpm, tuning:this.data.tuning,
          content:this.data.content
        });
      }
      // 4. 写入数据库
      if (this.data._id) {
        // --- 更新模式 (Update) ---
        // 编辑时保持历史状态字段不变；曲谱库会兼容旧状态。
        const current=await library.getSong({uid:this.data._id});
        if (!library.isActive(current) || current.type !== this.data.type) throw new Error('曲谱已变化，无法保存');
        await library.updateSong(this.data._id,songData);
      } else {
        // --- 新建模式 (Add) ---
        songData.createdAt = songData.id;
        songData.createTime = songData.createdAt;
        songData.status = 'active';
        songData.playlistIds = [];
        await db.collection('songs').add({
          data: songData
        });
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
    } finally {
      this._saving=false;
    }
  },

  // --- 🛠️ 工具函数：批量上传图片 ---
  uploadAllImages() {
    const uploadTasks = this.data.imagePaths.map(path => {
      // 如果已经是云端路径 (cloud://...)，直接返回，不用传
      if (path.startsWith('cloud://')) {
        return Promise.resolve(path);
      }

      // 如果是本地临时文件，需要上传
      // 生成一个云端文件名: my_scores/时间戳_随机数.png
      const cloudPath = `my_scores/${Date.now()}-${Math.floor(Math.random()*1000)}.png`;

      return wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: path
      }).then(res => {
        return res.fileID; // 返回上传后的 cloudID
      });
    });

    // 等待所有图片都处理完
    return Promise.all(uploadTasks);
  },

  uploadAllFiles() {
    const uploadTasks = this.data.filePaths.map(path => {
      if (path.startsWith('cloud://')) {
        return Promise.resolve(path);
      }

      const ext = path.split('.').pop() || 'pdf';
      const cloudPath = `my_scores/files/${Date.now()}-${Math.floor(Math.random()*1000)}.${ext}`;

      return wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: path
      }).then(res => {
        return res.fileID;
      });
    });

    return Promise.all(uploadTasks);
  },
  // 分享给朋友
  onShareAppMessage() {
    return getApp().globalShare();
  },

  // 分享到朋友圈
  onShareTimeline() {
    // 朋友圈模版通常只需要一个标题
    return {
      title: 'Lyra吉他谱本 - 吉他手的私人云端琴房',
      imageUrl: '/images/icon.png'
    }
  }
}));
