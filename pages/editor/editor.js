Page({
  data: {
    id: null,
    type: 'blank', // 可能的值：blank, paper, image
    title: '',
    artist: '',

    // 自制谱数据
    key: 'C',
    originalKey: 'C',
    capo: 0,
    timeSignature: '4/4',
    bpm: 90,
    tuning: '标准',
    content: '',
    placeholderText: "G Em C D \n池塘边的榕树上...",

    // 纸质谱数据
    location: '',

    // ✨ 图片谱数据 (统一使用数组)
    imagePaths: []
  },

  onLoad(options) {
    if (options.id) {
      // --- 编辑旧歌逻辑 ---
      this.setData({
        id: Number(options.id)
      });
      const allSongs = wx.getStorageSync('my_songs') || [];
      const song = allSongs.find(s => s.id === Number(options.id));

      if (song) {
        // ✨ 数据兼容处理：
        // 1. 如果是新数据(imagePaths)，直接用
        // 2. 如果是旧数据(imagePath)，把它包在数组里变成 [url]
        // 3. 如果都没有，就是空数组 []
        let paths = [];
        if (song.imagePaths && song.imagePaths.length > 0) {
          paths = song.imagePaths;
        } else if (song.imagePath) {
          paths = [song.imagePath];
        }

        this.setData({
          type: song.type,
          title: song.title,
          artist: song.artist || '',
          key: song.key,
          originalKey: song.originalKey,
          capo: song.capo,
          timeSignature: song.timeSignature,
          bpm: song.bpm,
          tuning: song.tuning,
          content: song.content,
          location: song.location,
          imagePaths: paths // 赋值给数组
        });
        wx.setNavigationBarTitle({
          title: '编辑乐谱'
        });
      }
    } else if (options.type) {
      // --- 新建逻辑 ---
      this.setData({
        type: options.type
      });
      let titleText = '新建乐谱';
      if (options.type === 'blank') titleText = '新建自制谱';
      if (options.type === 'paper') titleText = '纸质谱归档';
      if (options.type === 'image') titleText = '导入图片谱';
      wx.setNavigationBarTitle({
        title: titleText
      });
    }
  },

  // --- ✨ 功能1：选择图片 (支持多选) ---
  chooseImage() {
    wx.chooseMedia({
      count: 9, // 最多选9张
      mediaType: ['image'],
      sourceType: ['album', 'camera'], // 相册或相机
      success: (res) => {
        // 拿到新选的图片数组 (临时路径)
        const newFiles = res.tempFiles.map(f => f.tempFilePath);

        // 把新图追加到旧图后面 (concat)
        this.setData({
          imagePaths: this.data.imagePaths.concat(newFiles)
        });
      }
    });
  },

  // --- ✨ 功能2：删除某张已选的图 ---
  // 这个函数配合 wxml 里的 x 按钮使用
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const newPaths = this.data.imagePaths;
    newPaths.splice(index, 1); // 从数组中删掉第 index 张
    this.setData({
      imagePaths: newPaths
    });
  },
  // --- ✨ 新增：编辑器内的图片预览 ---
  previewCurrent(e) {
    // 1. 从 wxml 的 data-url 属性里拿到当前被点击的图片路径
    const currentUrl = e.currentTarget.dataset.url;

    // 2. 调用微信原生预览
    wx.previewImage({
      current: currentUrl,     // 当前显示哪张
      urls: this.data.imagePaths // 所有的图片列表（支持左右滑）
    });
  },
  // --- 保存逻辑 (核心重构) ---
  save() {
    // 1. 校验歌名
    if (!this.data.title) {
      wx.showToast({
        title: '请填写歌名',
        icon: 'none'
      });
      return;
    }

    // 2. 校验图片：如果是图片谱，必须至少有一张图
    if (this.data.type === 'image' && this.data.imagePaths.length === 0) {
      wx.showToast({
        title: '请至少选一张图',
        icon: 'none'
      });
      return;
    }

    // 3. 🌟 图片持久化保存 (循环处理每一张图)
    const fs = wx.getFileSystemManager();
    
    // map 函数会遍历数组，返回一个新的数组 (包含处理后的路径)
    const finalPaths = this.data.imagePaths.map(path => {
      // A. 如果路径里不包含 tmp/temp，说明已经是永久路径了(旧图)，直接返回
      if (!path.includes('tmp') && !path.includes('temp')) {
        return path;
      }

      // B. 如果是临时路径，需要保存到本地
      try {
        // 生成永久文件名
        const fileName = `score_${Date.now()}_${Math.random().toString(36).slice(-6)}.png`;
        // 目标路径
        const destPath = `${wx.env.USER_DATA_PATH}/${fileName}`;

        // 执行保存
        fs.saveFileSync(path, destPath);
        console.log("图片已永久保存：", destPath);
        
        return destPath; // 返回新的永久路径
      } catch (e) {
        console.error("存图失败", e);
        return path; // 如果保存失败，没办法，只能先存临时路径防止闪退
      }
    });

    // 4. 打包数据对象
    const newSong = {
      id: this.data.id || Date.now(),
      type: this.data.type,
      title: this.data.title,
      artist: this.data.artist,
      createTime: new Date().toLocaleDateString(),
      status: 'practicing', // 默认状态

      // 各个模式的数据
      key: this.data.key,
      originalKey: this.data.originalKey,
      capo: this.data.capo,
      timeSignature: this.data.timeSignature,
      bpm: this.data.bpm,
      tuning: this.data.tuning,
      content: this.data.content,
      location: this.data.location,
      
      // ✨ 这里只存 imagePaths 数组，不再存单数 imagePath
      imagePaths: finalPaths 
    };

    // 5. 更新本地存储
    let allSongs = wx.getStorageSync('my_songs') || [];

    if (this.data.id) {
      // 编辑模式：找到旧歌并替换
      const index = allSongs.findIndex(s => s.id === this.data.id);
      if (index > -1) {
        // 保持原有的状态 (status)，只更新内容
        newSong.status = allSongs[index].status;
        allSongs[index] = newSong;
      }
    } else {
      // 新建模式：追加到最前面
      allSongs.unshift(newSong);
    }

    // 存入 Storage
    wx.setStorageSync('my_songs', allSongs);

    // 6. 成功提示并返回
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
});