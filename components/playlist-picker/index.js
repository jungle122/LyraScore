const library = require('../../utils/library');
const theme = require('../../utils/theme');
Component({
  properties: { visible:Boolean, songIds:Array, themeStyle:String },
  data: { playlists:[], selected:[], loading:false, error:'', busy:false, creating:false },
  observers: { visible(value) { if (value) { this.setData({selected:[]}); this.load(); } } },
  methods: {
    noop() {},
    close() { if (!this.data.busy && !this.data.creating) this.triggerEvent('close'); },
    async load() {
      this.setData({loading:true,error:''});
      try { this.setData({playlists:(await library.playlistsWithCounts()).map(p => ({...p, selected:this.data.selected.includes(p._id)}))}); }
      catch(e) { this.setData({error:library.errorText(e)}); }
      finally { this.setData({loading:false}); }
    },
    toggle(e) {
      if (this.data.busy) return;
      const id=e.currentTarget.dataset.id;
      const selected=this.data.selected.includes(id)?this.data.selected.filter(x=>x!==id):this.data.selected.concat(id);
      this.setData({selected,playlists:this.data.playlists.map(p=>({...p,selected:selected.includes(p._id)}))});
    },
    async create() {
      if(this.data.busy || this.data.creating) return;
      this.setData({creating:true});
      try {
        const res=await theme.modal({title:'新建歌单',editable:true,placeholderText:'输入歌单名称（1–30 字）'});
        if(!res.confirm) return;
        const id=await library.savePlaylist(res.content);
        this.setData({selected:this.data.selected.concat(id)}); await this.load();
      } catch(e) { wx.showToast({title:library.errorText(e,'创建失败，请重试'),icon:'none'}); }
      finally {this.setData({creating:false});}
    },
    async confirm() {
      if(this.data.busy || !this.data.selected.length || !this.data.songIds.length) return;
      this.setData({busy:true});
      try {
        const result=await library.changeMembership(this.data.songIds,this.data.selected);
        if(result.failed.length) {
          this.setData({error:library.batchMessage(result,'加入')});
        } else {
          wx.showToast({title:'已加入歌单',icon:'success'}); this.triggerEvent('done'); this.triggerEvent('close');
        }
      } catch(e) {this.setData({error:library.errorText(e,'加入失败，请重试')});}
      finally {this.setData({busy:false});}
    }
  }
});
