const library=require('../../utils/library');
const {statusOf}=require('../../utils/songFilters');
const theme=require('../../utils/theme');
Page(theme.page({
  data:{trashList:[],loading:false,error:'',busy:false},
  onShow(){return this.load();},
  async load(){
    this.setData({loading:true,error:''});
    try{const songs=await library.all('songs');this.setData({trashList:songs.filter(s=>statusOf(s.status)==='deleted').sort((a,b)=>(b.deleteDate || 0)-(a.deleteDate || 0)).map(s=>({...s,deletedText:s.deleteDate?new Date(s.deleteDate).toLocaleDateString():'未知'}))});}
    catch(e){this.setData({error:library.errorText(e)});}
    finally{this.setData({loading:false});}
  },
  async recoverSong(e){
    if(this.data.busy)return;this.setData({busy:true});
    try{await library.restoreSong(e.currentTarget.dataset.id);await this.load();wx.showToast({title:'已恢复到曲谱库',icon:'success'});}
    catch(error){wx.showToast({title:library.errorText(error,'恢复失败，请重试'),icon:'none'});}
    finally{this.setData({busy:false});}
  },
  deleteForever(e){return this.purge([e.currentTarget.dataset.id]);},
  clearAll(){return this.purge(this.data.trashList.map(s=>s._id));},
  async purge(ids){
    if(this.data.busy || !ids.length)return;this.setData({busy:true});
    try{
      const res=await theme.modal({title:'彻底删除',content:`永久删除 ${ids.length} 首曲谱及不再使用的附件？此操作无法恢复。`,confirmColor:'#D14343',confirmText:'彻底删除'});
      if(!res.confirm)return;
      const result=await library.batch(ids,library.purgeSong);await this.load();
      if(result.failed.length)this.setData({error:`已清理 ${result.succeeded.length} 首，${result.failed.length} 首失败。请对剩余曲谱重试彻底删除。`});
      else wx.showToast({title:'清理完成',icon:'success'});
    }catch(e){this.setData({error:library.errorText(e,'清理失败，请重试')});await this.load();}
    finally{this.setData({busy:false});}
  }
}));
