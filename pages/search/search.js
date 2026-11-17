const library=require('../../utils/library');
const {filterSongs}=require('../../utils/songFilters');
Page(require('../../utils/theme').page({
  data:{keyword:'',resultList:[],error:'',loading:false},
  onShow(){return this.load();},
  async load(){this.setData({loading:true,error:''});try{this._songs=await library.all('songs');this.search();}catch(e){this.setData({error:library.errorText(e)});}finally{this.setData({loading:false});}},
  onSearchInput(e){this.setData({keyword:e.detail.value});this.search();},
  search(){const word=this.data.keyword.trim().toLowerCase();this.setData({resultList:word?filterSongs(this._songs || [],'active',{selectedInstrument:'all',selectedStyle:'all',selectedType:'all',selectedSort:'newest'}).filter(s=>`${s.title || ''}\n${s.artist || ''}`.toLowerCase().includes(word)):[]});},
  clearSearch(){this.setData({keyword:'',resultList:[]});},
  goToDetail(e){wx.navigateTo({url:`/pages/reader/reader?uid=${encodeURIComponent(e.currentTarget.dataset.id)}`});},
  onShareAppMessage(){return getApp().globalShare();}
}));
