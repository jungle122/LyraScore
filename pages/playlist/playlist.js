const library=require('../../utils/library');
const theme=require('../../utils/theme');
const {filterSongs,sortOptions}=require('../../utils/songFilters');
const filters={selectedInstrument:'all',selectedStyle:'all',selectedType:'all',selectedSort:'newest'};
Page(theme.page({
  data:{playlistId:'',name:'歌单',songList:[],sortOptions,sortIndex:0,isEditMode:false,selectedIds:[],loading:false,error:'',busy:false,missing:false,
    showAdd:false,addKeyword:'',addRows:[],addIds:[],addError:''},
  onLoad(options){this.setData({playlistId:options.id || ''});},
  onShow(){this.setData({selectedIds:[]});return this.load();},
  async load(){
    this.setData({loading:true,error:'',missing:false});
    try{
      const [playlists,songs]=await Promise.all([library.all('playlists',{_id:this.data.playlistId}),library.all('songs')]);
      if(!playlists.length){this.setData({missing:true,songList:[],name:'歌单已删除'});return;}
      this._songs=songs;this.setData({name:playlists[0].name});wx.setNavigationBarTitle({title:playlists[0].name});this.apply();
    }catch(e){this.setData({error:library.errorText(e)});}
    finally{this.setData({loading:false});}
  },
  apply(){
    const members=(this._songs || []).filter(s=>(s.playlistIds || []).includes(this.data.playlistId));
    const songList=filterSongs(members,'active',{...filters,selectedSort:sortOptions[this.data.sortIndex].value});
    const selectedIds=this.data.selectedIds.filter(id=>songList.some(s=>s._id===id));
    this.setData({songList:songList.map(song=>({...song,selected:selectedIds.includes(song._id)})),selectedIds});
  },
  onSortChange(e){this.setData({sortIndex:Number(e.detail.value)});this.apply();},
  toggleManage(){if(!this.data.busy)this.setData({isEditMode:!this.data.isEditMode,selectedIds:[]});},
  selectAll(){if(!this.data.busy){const selectedIds=this.data.selectedIds.length===this.data.songList.length?[]:this.data.songList.map(s=>s._id);this.setData({selectedIds,songList:this.data.songList.map(song=>({...song,selected:selectedIds.includes(song._id)}))});}},
  tapSong(e){const id=e.currentTarget.dataset.id;if(this.data.busy)return;if(this.data.isEditMode){const selectedIds=this.data.selectedIds.includes(id)?this.data.selectedIds.filter(x=>x!==id):this.data.selectedIds.concat(id);this.setData({selectedIds,songList:this.data.songList.map(song=>({...song,selected:selectedIds.includes(song._id)}))});}else wx.navigateTo({url:`/pages/reader/reader?uid=${encodeURIComponent(id)}`});},
  async remove(){
    if(this.data.busy || !this.data.selectedIds.length)return;this.setData({busy:true});
    try{
      const res=await theme.modal({title:'从歌单移除',content:'选中的曲谱仍会保留在曲谱库。'});if(!res.confirm)return;
      const result=await library.changeMembership(this.data.selectedIds,[this.data.playlistId],true);
      await this.load();this.setData({selectedIds:result.failed.map(f=>f.id)});wx.showToast({title:library.batchMessage(result,'移除'),icon:'none'});
    }catch(e){wx.showToast({title:library.errorText(e,'移除失败，请重试'),icon:'none'});}
    finally{this.setData({busy:false});}
  },
  async openAdd(){if(this.data.busy)return;this.setData({showAdd:true,addIds:[],addKeyword:'',addError:''});await this.load();this.filterAdd();},
  closeAdd(){if(!this.data.busy)this.setData({showAdd:false});},
  noop(){},
  inputAdd(e){this.setData({addKeyword:e.detail.value});this.filterAdd();},
  filterAdd(){
    const keyword=this.data.addKeyword.trim().toLowerCase();
    const addRows=filterSongs(this._songs || [],'active',filters).filter(s=>`${s.title || ''}\n${s.artist || ''}`.toLowerCase().includes(keyword)).map(s=>({...s,already:(s.playlistIds || []).includes(this.data.playlistId),checked:this.data.addIds.includes(s._id)}));
    this.setData({addRows});
  },
  toggleAdd(e){if(this.data.busy)return;const song=this.data.addRows.find(s=>s._id===e.currentTarget.dataset.id);if(!song || song.already)return;const ids=this.data.addIds;this.setData({addIds:ids.includes(song._id)?ids.filter(id=>id!==song._id):ids.concat(song._id)});this.filterAdd();},
  async confirmAdd(){
    if(this.data.busy || !this.data.addIds.length || this.data.error || this.data.missing)return;this.setData({busy:true,addError:''});
    try{
      const result=await library.changeMembership(this.data.addIds,[this.data.playlistId]);await this.load();
      this.setData({addIds:result.failed.map(f=>f.id),addError:result.failed.length?library.batchMessage(result,'添加'):'',showAdd:!!result.failed.length});this.filterAdd();
    }catch(e){this.setData({addError:library.errorText(e,'添加失败，请重试')});}
    finally{this.setData({busy:false});}
  }
}));
