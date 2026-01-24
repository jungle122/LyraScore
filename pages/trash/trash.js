Page({
  data: {
    trashList: []
  },

  onShow() {
    this.loadTrash();
  },

  loadTrash() {
    const allSongs = wx.getStorageSync('my_songs') || [];
    
    // 1. 筛选出 status 为 'deleted' 的歌
    const deletedSongs = allSongs.filter(s => s.status === 'deleted');
    
    // 2. 为每一首歌计算“剩余有效期”
    // map 函数可以给数据“整容”，加上我们需要的新字段
    const listWithDays = deletedSongs.map(song => {
      // 获取删除时间 (如果没有记录，就默认是现在)
      const deleteTime = song.deleteDate || Date.now();
      // 算出过去了多少毫秒
      const diff = Date.now() - deleteTime;
      // 换算成天数 (1天 = 24*60*60*1000 毫秒)
      const daysPassed = Math.floor(diff / (24 * 60 * 60 * 1000));
      // 算出剩余天数 (30天有效期)
      let daysLeft = 30 - daysPassed;
      
      // 只有剩余天数 > 0 的才显示，过期的其实应该自动清理(这里为了简单先不管)
      if (daysLeft < 0) daysLeft = 0;

      // 把 daysLeft 这个新属性加进去
      return { ...song, daysLeft }; 
    });

    this.setData({ trashList: listWithDays });
  },

  // --- 功能1：恢复 (后悔了) ---
  recoverSong(e) {
    const id = e.currentTarget.dataset.id;
    
    // 1. 拿到所有歌
    let allSongs = wx.getStorageSync('my_songs') || [];
    // 2. 找到这首歌，把状态改回 'practicing'
    const index = allSongs.findIndex(s => s.id === id);
    if (index > -1) {
      allSongs[index].status = 'practicing';
      // 清除删除时间
      delete allSongs[index].deleteDate;
    }
    
    // 3. 存回去 & 刷新列表
    wx.setStorageSync('my_songs', allSongs);
    this.loadTrash();
    
    wx.showToast({ title: '已恢复', icon: 'success' });
  },

  // --- 功能2：彻底删除 (永别了) ---
  deleteForever(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '彻底销毁',
      content: '删除后将无法找回，确定吗？',
      confirmColor: '#ff4d4f', // 红色警示
      success: (res) => {
        if (res.confirm) {
          let allSongs = wx.getStorageSync('my_songs') || [];
          
          // 过滤掉这首歌 (真的从数组里踢出去了)
          const newSongs = allSongs.filter(s => s.id !== id);
          
          wx.setStorageSync('my_songs', newSongs);
          this.loadTrash(); // 刷新
          
          wx.showToast({ title: '已销毁', icon: 'none' });
        }
      }
    });
  }
});