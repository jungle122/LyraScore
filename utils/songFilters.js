// 存入时间独立于修改时间。部分 MySQL 迁移数据使用 2000000000000 + 原记录 ID
// 作为兼容 ID，不能把该 ID 当作时间；这批数据的真实日期保存在 createTime。
function timestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) && n >= 946684800000 && n <= 8640000000000000 ? n : null;
  }
  const matched = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!matched) return null;
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), Number(matched[4] || 0), Number(matched[5] || 0), Number(matched[6] || 0));
  return date.getFullYear() === Number(matched[1]) && date.getMonth() === Number(matched[2]) - 1 && date.getDate() === Number(matched[3]) ? date.getTime() : null;
}

function storedAt(song) {
  const legacyId = timestamp(song.id);
  const isMigratedId = legacyId !== null && legacyId >= 2000000000000 && legacyId < 2001000000000;
  return timestamp(song.createdAt) || timestamp(song.createTime) || (isMigratedId ? null : legacyId);
}

function normalize(value, aliases) {
  return aliases[String(value || '').trim().toLowerCase()] || 'unknown';
}

function statusOf(value) {
  const status = normalize(value, {
    practicing: 'practicing', practising: 'practicing', in_progress: 'practicing', ongoing: 'practicing',
    '正在练': 'practicing', '练习中': 'practicing', finished: 'finished', completed: 'finished', done: 'finished',
    '已练完': 'finished', '已完成': 'finished', deleted: 'deleted', trash: 'deleted', '已删除': 'deleted'
  });
  return status === 'unknown' ? 'practicing' : status;
}

const groups = [
  { key: 'selectedInstrument', label: '乐器', options: [{value:'all',label:'全部'}, {value:'guitar',label:'吉他'}, {value:'ukulele',label:'尤克里里'}, {value:'unknown',label:'未分类'}] },
  { key: 'selectedStyle', label: '演奏方式', options: [{value:'all',label:'全部'}, {value:'fingerstyle',label:'弹唱'}, {value:'picking',label:'指弹'}, {value:'unknown',label:'未分类'}] },
  { key: 'selectedType', label: '曲谱类型', options: [{value:'all',label:'全部'}, {value:'blank',label:'文字谱'}, {value:'image',label:'图片谱'}, {value:'paper',label:'纸质归档'}, {value:'unknown',label:'未分类'}] }
];
const sortOptions = [{value:'newest',label:'最新存入'}, {value:'oldest',label:'最早存入'}, {value:'name',label:'名称排序'}];

function filterSongs(rows, status, filters) {
  return rows.filter(song => {
    const values = {
      selectedInstrument: normalize(song.instrument, {'吉他':'guitar',guitar:'guitar','尤克里里':'ukulele',ukulele:'ukulele'}),
      selectedStyle: normalize(song.style, {'弹唱':'fingerstyle',fingerstyle:'fingerstyle','指弹':'picking',picking:'picking'}),
      selectedType: normalize(song.type, {blank:'blank',image:'image',paper:'paper'})
    };
    return (status === 'active' ? statusOf(song.status) !== 'deleted' && !song.purgeStarted : statusOf(song.status) === status) && groups.every(g => filters[g.key] === 'all' || filters[g.key] === values[g.key]);
  }).sort((a,b) => {
    const tie = () => String(a._id || a.id || '').localeCompare(String(b._id || b.id || ''));
    if (filters.selectedSort === 'name') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN') || tie();
    const x = storedAt(a), y = storedAt(b);
    if (x === null || y === null) return x === y ? tie() : x === null ? 1 : -1;
    return (filters.selectedSort === 'oldest' ? x - y : y - x) || tie();
  }).map(song => {
    const time = storedAt(song);
    const date = time === null ? null : new Date(time);
    return {...song, storedDateText: date ? `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}` : '未知'};
  });
}

function listMethods(status) {
  return {
    applyFilters() {
      let songList = filterSongs(this._allSongs || [], status, this.data);
      const labels = groups.filter(g => this.data[g.key] !== 'all').map(g => g.options.find(o => o.value === this.data[g.key]).label);
      const visible = new Set(songList.map(s => s._id));
      const selectedIds = this.data.selectedIds.filter(id => visible.has(id));
      songList = songList.map(song => ({ ...song, selected: selectedIds.includes(song._id) }));
      this.setData({songList, selectedIds, filterCount: labels.length, filterSummary: labels.join(' · ') || '全部曲谱'});
    },
    openFilters() {
      const draftFilters = {};
      groups.forEach(g => { draftFilters[g.key] = this.data[g.key]; });
      this.setData({showFilters: true, draftFilters});
    },
    closeFilters() { this.setData({showFilters: false}); },
    stopPanelTap() {},
    changeDraftFilter(e) {
      const {key, value} = e.currentTarget.dataset;
      this.setData({draftFilters: {...this.data.draftFilters, [key]: value}});
    },
    resetDraftFilters() { this.setData({draftFilters: {selectedInstrument:'all',selectedStyle:'all',selectedType:'all'}}); },
    confirmFilters() {
      this.setData({...this.data.draftFilters, showFilters:false, selectedIds:[]});
      this.applyFilters();
    },
    resetFilters() {
      this.setData({selectedInstrument:'all',selectedStyle:'all',selectedType:'all',selectedIds:[]});
      this.applyFilters();
    },
    onSortChange(e) {
      const index = Number(e.detail.value);
      if (!sortOptions[index]) return;
      this.setData({selectedSort:sortOptions[index].value,sortIndex:index});
      this.applyFilters();
    }
  };
}

module.exports = { statusOf, storedAt, filterSongs, groups, sortOptions, listMethods };
