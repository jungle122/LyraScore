const library = require('../../utils/library');
const theme = require('../../utils/theme');
const { groups, sortOptions, listMethods } = require('../../utils/songFilters');
Page(theme.page({
  ...listMethods('active'),
  data: {songList:[],filterGroups:groups,sortOptions,sortIndex:0,selectedInstrument:'all',selectedStyle:'all',selectedType:'all',selectedSort:'newest',
    showFilters:false,draftFilters:{},filterCount:0,filterSummary:'全部曲谱',isEditMode:false,selectedIds:[],showPlaylistPicker:false,error:'',loading:false,busy:false},
  onShow() {this.setData({selectedIds:[],showFilters:false});return this.loadSongs();},
  async loadSongs() {
    const request = this._request = (this._request || 0) + 1;
    this.setData({loading:true,error:''});
    try { const songs=await library.all('songs'); if(request!==this._request)return; this._allSongs=songs;this.applyFilters(); }
    catch(e) {if(request===this._request)this.setData({error:library.errorText(e)});}
    finally {if(request===this._request)this.setData({loading:false});}
  },
  toggleEditMode() {if(!this.data.busy)this.setData({isEditMode:!this.data.isEditMode,selectedIds:[]});},
  toggleSelectById(id) {if(this.data.busy)return;const selectedIds=this.data.selectedIds.includes(id)?this.data.selectedIds.filter(x=>x!==id):this.data.selectedIds.concat(id);this.setData({selectedIds,songList:this.data.songList.map(song=>({...song,selected:selectedIds.includes(song._id)}))});},
  toggleSelectItem(e) {this.toggleSelectById(e.currentTarget.dataset.uid);},
  toggleSelectAll() {if(!this.data.busy){const selectedIds=this.data.selectedIds.length===this.data.songList.length?[]:this.data.songList.map(s=>s._id);this.setData({selectedIds,songList:this.data.songList.map(song=>({...song,selected:selectedIds.includes(song._id)}))});}},
  onCardTap(e) {const id=e.currentTarget.dataset.uid;if(this.data.isEditMode)this.toggleSelectById(id);else wx.navigateTo({url:`/pages/reader/reader?uid=${encodeURIComponent(id)}`});},
  goToSearch() {wx.navigateTo({url:'/pages/search/search'});},
  openPlaylistPicker() {if(this.data.selectedIds.length)this.setData({showPlaylistPicker:true});},
  closePlaylistPicker() {this.setData({showPlaylistPicker:false});},
  async batchDelete() {
    if(this.data.busy || !this.data.selectedIds.length)return;
    this.setData({busy:true});
    try {
      const ids=this.data.selectedIds.slice();
      const res=await theme.modal({title:'移入回收站',content:`将选中的 ${ids.length} 首曲谱移入回收站？之后可以恢复。`,confirmColor:'#D14343'});
      if(!res.confirm)return;
      const result=await library.trashSongs(ids);await this.loadSongs();
      this.setData({selectedIds:result.failed.map(x=>x.id)});
      wx.showToast({title:library.batchMessage(result,'删除'),icon:'none'});
    } catch(e) {wx.showToast({title:library.errorText(e,'删除失败，请重试'),icon:'none'});}
    finally {this.setData({busy:false});}
  },
  onShareAppMessage() {return getApp().globalShare();}
}));
