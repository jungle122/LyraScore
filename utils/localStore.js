// 本地数据层：取代 wx.cloud.database()
// - 曲谱元数据（标题/调/状态/备注/content…）存在 wx.setStorageSync('lyra_songs')
//   纯文本，体积很小，远低于 10MB 上限。
// - 图片/PDF 存在文件系统 USER_DATA_PATH/lyra-files 下，曲谱记录里保存其本地路径。
// 每条记录同时带 id（时间戳，页面跳转用）和 _id（本地生成的唯一串，更新/删除用），
// 与原云端字段保持一致，方便页面平滑切换。

const SONGS_KEY = 'lyra_songs';
const FILES_DIR = `${wx.env.USER_DATA_PATH}/lyra-files`;

const fs = wx.getFileSystemManager();

function ensureDir() {
  try {
    fs.accessSync(FILES_DIR);
  } catch (e) {
    try { fs.mkdirSync(FILES_DIR, true); } catch (err) {}
  }
}

// 读取全部曲谱（同步）
function getAllSongs() {
  return wx.getStorageSync(SONGS_KEY) || [];
}

// 覆盖写入全部曲谱（同步）
function saveAllSongs(list) {
  wx.setStorageSync(SONGS_KEY, Array.isArray(list) ? list : []);
}

// 按 id（时间戳）查单条 —— 对应原 where({ id }).get()
function getSongById(id) {
  const numId = Number(id);
  return getAllSongs().find(s => Number(s.id) === numId) || null;
}

// 按 _id 查单条
function getSongByDocId(_id) {
  return getAllSongs().find(s => s._id === _id) || null;
}

function genDocId() {
  return `local_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// 新增 —— 对应原 collection.add()
function addSong(data) {
  const list = getAllSongs();
  const record = Object.assign({}, data);
  if (!record.id) record.id = Date.now();
  record._id = genDocId();
  list.push(record);
  saveAllSongs(list);
  return record;
}

// 按 _id 局部更新 —— 对应原 doc(_id).update({ data })
function updateSong(_id, partial) {
  const list = getAllSongs();
  const idx = list.findIndex(s => s._id === _id);
  if (idx === -1) return null;
  list[idx] = Object.assign({}, list[idx], partial);
  saveAllSongs(list);
  return list[idx];
}

// 按 _id 彻底删除（连带删掉它的本地文件）—— 对应原 doc(_id).remove()
function removeSong(_id) {
  const list = getAllSongs();
  const target = list.find(s => s._id === _id);
  if (target) deleteLocalFiles(target);
  saveAllSongs(list.filter(s => s._id !== _id));
}

// 删除某条曲谱在本地的图片/PDF 文件
function deleteLocalFiles(song) {
  const paths = []
    .concat(Array.isArray(song.imagePaths) ? song.imagePaths : [])
    .concat(Array.isArray(song.filePaths) ? song.filePaths : []);
  if (song.imagePath) paths.push(song.imagePath);
  paths.forEach(p => {
    if (p && typeof p === 'string' && p.indexOf(FILES_DIR) === 0) {
      try { fs.unlinkSync(p); } catch (e) {}
    }
  });
}

// 把一个临时文件复制进本地持久目录，返回稳定的本地路径
// 用于编辑页保存图片/PDF（取代 wx.cloud.uploadFile），以及迁移时落盘
function saveTempFile(tempPath, ext) {
  ensureDir();
  const guessed = ext || (tempPath.split('.').pop() || 'dat');
  const cleanExt = String(guessed).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'dat';
  const dest = `${FILES_DIR}/${Date.now()}-${Math.floor(Math.random() * 100000)}.${cleanExt}`;
  fs.copyFileSync(tempPath, dest);
  return dest;
}

module.exports = {
  SONGS_KEY,
  FILES_DIR,
  getAllSongs,
  saveAllSongs,
  getSongById,
  getSongByDocId,
  addSong,
  updateSong,
  removeSong,
  saveTempFile,
};
