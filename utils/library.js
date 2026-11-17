const { statusOf } = require('./songFilters');
function db() { return wx.cloud.database(); }
function owned(collection, where = {}) { return db().collection(collection).where({ ...where, _openid: '{openid}' }); }
async function all(collection, where = {}) {
  const rows = [];
  for (let skip = 0; ; skip += 20) {
    const res = await owned(collection, where).orderBy('_id', 'asc').skip(skip).limit(20).get();
    rows.push(...res.data);
    if (res.data.length < 20) return rows;
  }
}
function isActive(song) { return statusOf(song.status) !== 'deleted' && !song.purgeStarted; }
async function getSong(options) {
  const where = options.uid ? { _id: options.uid } : { id: Number(options.id) };
  const res = await owned('songs', where).limit(1).get();
  if (!res.data.length) throw new Error('曲谱不存在或无权访问');
  return res.data[0];
}
async function updateSong(id, data) {
  const res = await owned('songs', { _id: id }).update({ data });
  if (!res.stats) throw new Error('曲谱更新失败，请重试');
  // addToSet/pull 在目标值已经处于期望状态时可能返回 updated=0。
  // 再读一次可区分安全的幂等重试与记录已被删除。
  if (res.stats.updated === 0) await getSong({ uid:id });
}
async function batch(ids, operation) {
  const failed = [], succeeded = [];
  for (const id of [...new Set(ids)]) {
    try { await operation(id); succeeded.push(id); } catch (error) { failed.push({ id, message: error.message || error.errMsg || '操作失败' }); }
  }
  return { succeeded, failed };
}
function batchMessage(result, verb) {
  return result.failed.length ? `${verb}成功 ${result.succeeded.length} 项，失败 ${result.failed.length} 项，请重试` : `${verb}成功`;
}
function nameValue(value) {
  const name = String(value || '').trim();
  if (!name || Array.from(name).length > 30) throw new Error('歌单名称请输入 1–30 个字');
  return name;
}
async function savePlaylist(value, id) {
  const name = nameValue(value);
  const existing = await all('playlists', { name });
  if (existing.some(p => p._id !== id)) throw new Error('已存在同名歌单');
  const now = Date.now();
  if (id) {
    const res = await owned('playlists', { _id: id }).update({ data: { name, updatedAt: now } });
    if (!res.stats || res.stats.updated !== 1) throw new Error('歌单不存在或无权修改');
    return id;
  }
  try {
    const res = await db().collection('playlists').add({ data: { name, createdAt: now, updatedAt: now } });
    return res._id;
  } catch (e) {
    if (/duplicate|E11000/i.test(e.errMsg || e.message || '')) throw new Error('已存在同名歌单');
    throw e;
  }
}
async function playlistsWithCounts() {
  const [playlists, songs] = await Promise.all([all('playlists'), all('songs')]);
  return playlists.map(p => ({ ...p, count: songs.filter(s => isActive(s) && (s.playlistIds || []).includes(p._id)).length }))
    .sort((a,b) => b.createdAt - a.createdAt || a._id.localeCompare(b._id));
}
async function changeMembership(songIds, playlistIds, remove = false) {
  const valid = await all('playlists');
  if (!playlistIds.length || playlistIds.some(id => !valid.some(p => p._id === id))) throw new Error('歌单已删除，请刷新后重试');
  const command = db().command;
  return batch(songIds, async id => {
    const song = await getSong({ uid:id });
    if (!isActive(song)) throw new Error('曲谱已删除');
    // CloudBase 小程序端 addToSet 接受单个值，逐个写入仍保持原子去重。
    for (const playlistId of playlistIds) {
      await updateSong(id, { playlistIds: remove ? command.pull(playlistId) : command.addToSet(playlistId) });
    }
  });
}
async function deletePlaylist(id) {
  // 先删除歌单；失效关联不可见，失败清理可安全重试。
  const res = await owned('playlists', { _id:id }).remove();
  if (!res.stats || res.stats.removed !== 1) throw new Error('歌单不存在或无权删除');
  return cleanupPlaylistLinks(id);
}
async function cleanupPlaylistLinks(id) {
  const songs = await all('songs', { playlistIds:id });
  return batch(songs.map(s => s._id), songId => updateSong(songId, { playlistIds: db().command.pull(id) }));
}
async function trashSongs(ids) {
  return batch(ids, id => updateSong(id, { status:'deleted', deleteDate:Date.now() }));
}
async function restoreSong(id) {
  const song = await getSong({ uid:id });
  if (song.purgeStarted) throw new Error('已开始彻底删除，无法恢复，请重试清理');
  await updateSong(id, { status:'active', deleteDate:null });
}
function attachments(song) {
  return [...new Set([...(song.imagePaths || []), ...(song.filePaths || []), song.imagePath].filter(p => typeof p === 'string' && p.startsWith('cloud://')))];
}
async function purgeSong(id) {
  const song = await getSong({ uid:id });
  if (statusOf(song.status) !== 'deleted') throw new Error('只能彻底删除回收站中的曲谱');
  // 标记先持久化：任何部分失败/退出后都可重试，且禁止恢复半清理记录。
  await updateSong(id, { purgeStarted:true });
  const others = (await all('songs')).filter(s => s._id !== id);
  const referenced = new Set(others.flatMap(attachments));
  const completed = new Set(song.purgedFiles || []);
  for (const fileID of attachments(song)) {
    if (referenced.has(fileID) || completed.has(fileID)) continue;
    const result = await wx.cloud.deleteFile({ fileList:[fileID] });
    const file = (result.fileList || []).find(f => f.fileID === fileID);
    // 不存在的文件也视为已清理；其余失败保留记录，禁止吞掉权限/网络错误。
    if (!file || (file.status !== 0 && file.status !== -503003)) throw new Error('附件清理失败，请重试彻底删除');
    completed.add(fileID);
    await updateSong(id, { purgedFiles:Array.from(completed) });
  }
  const result = await owned('songs', { _id:id }).remove();
  if (!result.stats || result.stats.removed !== 1) throw new Error('记录清理失败，请重试');
}
function errorText(error, fallback = '加载失败，请重试') {
  const text = String(error && (error.message || error.errMsg) || '');
  if (/collection.*not exist|DATABASE_COLLECTION_NOT_EXIST|collection not exists|-502005/i.test(text)) return '歌单数据尚未配置，请创建 playlists 集合后重试';
  if (/permission|PERMISSION|denied/i.test(text)) return '暂无数据访问权限，请检查云端配置后重试';
  return error && error.message && !/cloud|database|request/i.test(text) ? text : fallback;
}
module.exports = { owned, all, isActive, getSong, updateSong, batch, batchMessage, nameValue, savePlaylist, playlistsWithCounts,
  changeMembership, deletePlaylist, cleanupPlaylistLinks, trashSongs, restoreSong, attachments, purgeSong, errorText };
