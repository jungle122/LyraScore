const library=require('../../utils/library');
const theme=require('../../utils/theme');
Page(theme.page({
  data:{playlists:[],loading:false,error:'',busy:false,cleanupId:''},
  onShow(){return this.load();},
  async load(){
    this.setData({loading:true,error:''});
    try{this.setData({playlists:await library.playlistsWithCounts()});}
    catch(e){this.setData({error:library.errorText(e)});}
    finally{this.setData({loading:false});}
  },
  open(e){wx.navigateTo({url:`/pages/playlist/playlist?id=${encodeURIComponent(e.currentTarget.dataset.id)}`});},
  async create(){await this.editName();},
  async editName(id,name=''){
    if(this.data.busy)return;this.setData({busy:true});
    try{
      const res=await theme.modal({title:id?'重命名歌单':'新建歌单',editable:true,content:name,placeholderText:'输入歌单名称（1–30 字）'});
      if(!res.confirm)return;
      await library.savePlaylist(res.content,id);await this.load();
    }catch(e){wx.showToast({title:library.errorText(e,'保存失败，请重试'),icon:'none'});}
    finally{this.setData({busy:false});}
  },
  async menu(e){
    if(this.data.busy)return;
    const p=this.data.playlists.find(x=>x._id===e.currentTarget.dataset.id);if(!p)return;
    const choice=await wx.showActionSheet({itemList:['重命名','删除歌单']}).catch(()=>null);if(!choice)return;
    if(choice.tapIndex===0)return this.editName(p._id,p.name);
    this.setData({busy:true});
    try{
      const res=await theme.modal({title:'删除歌单',content:`删除“${p.name}”？其中的曲谱仍保留在曲谱库。`,confirmColor:'#D14343'});if(!res.confirm)return;
      const result=await library.deletePlaylist(p._id);
      if(result.failed.length)this.setData({cleanupId:p._id});
      await this.load();
      wx.showToast({title:result.failed.length?'歌单已删除，部分关联待清理':'歌单已删除',icon:'none'});
    }catch(e){wx.showToast({title:library.errorText(e,'删除失败，请重试'),icon:'none'});}
    finally{this.setData({busy:false});}
  },
  async retryCleanup(){
    if(this.data.busy)return;this.setData({busy:true});
    try{const result=await library.cleanupPlaylistLinks(this.data.cleanupId);if(!result.failed.length)this.setData({cleanupId:''});else wx.showToast({title:'部分关联清理失败，请重试',icon:'none'});}
    catch(e){wx.showToast({title:library.errorText(e),icon:'none'});}
    finally{this.setData({busy:false});}
  }
}));
