const palettes = {
  pink: { name: '经典粉色', primary: '#FA7298', text: '#B93660', soft: '#FFF5F8' },
  neutral: { name: '中性黑灰', primary: '#333333', text: '#333333', soft: '#F0F0F0' }
};
const listeners = new Set();
let current = 'pink';
let appearance = 'system';
let systemTheme = 'light';
let watching = false;
const appearances = {system:'跟随系统',light:'白天模式',dark:'黑夜模式'};
function read() {
  try { const saved = wx.getStorageSync('lyra_theme'); current = palettes[saved] ? saved : 'pink'; } catch (_) { current = 'pink'; }
  try {
    const saved = wx.getStorageSync('lyra_appearance');
    appearance = appearances[saved] ? saved : 'system';
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    systemTheme = info.theme === 'dark' ? 'dark' : 'light';
  } catch (_) { /* 旧基础库保留当前系统主题。 */ }
  return current;
}
function data() {
  const dark = (appearance === 'system' ? systemTheme : appearance) === 'dark';
  const t = palettes[current];
  const primary = dark && current === 'neutral' ? '#E6E6E6' : t.primary;
  const colors = {
    primary,
    'on-primary': dark ? '#202020' : '#FFFFFF',
    'accent-text': dark ? (current === 'pink' ? '#FF9FBB' : '#E6E6E6') : t.text,
    soft: dark ? (current === 'pink' ? '#38232C' : '#303030') : t.soft,
    'page-bg': dark ? '#171717' : '#F8F8F8',
    'card-bg': dark ? '#232323' : '#FFFFFF',
    'surface-bg': dark ? '#2D2D2D' : '#F5F5F5',
    'text-main': dark ? '#EEEEEE' : '#333333',
    'text-secondary': dark ? '#B8B8B8' : '#666666',
    'text-muted': dark ? '#A0A0A0' : '#888888',
    border: dark ? '#444444' : '#E6E6E6',
    'danger-bg': dark ? '#3D2424' : '#FFF0F0',
    danger: dark ? '#FF9292' : '#C23838',
    'image-bg': dark ? '#382F1E' : '#FFF7E6',
    'paper-bg': dark ? '#34263D' : '#F9F0FF',
    'text-score-bg': dark ? '#203342' : '#E3F2FD',
    'text-score-color': dark ? '#8BC8FF' : '#1976D2',
    'paper-color': dark ? '#D4A1E2' : '#AB47BC'
  };
  return {themeId:current, themeName:t.name, themePrimary:primary,
    themeIcon:dark && current === 'neutral' ? 'light' : current,
    appearance, appearanceName:appearances[appearance], isDark:dark,
    pageBackground:colors['page-bg'], cardBackground:colors['card-bg'],
    themeStyle:Object.entries(colors).map(([key,value]) => '--' + key + ':' + value).join(';') + ';'};
}
function tabBar() {
  const state = data();
  if (wx.setNavigationBarColor) wx.setNavigationBarColor({frontColor:state.isDark ? '#ffffff' : '#000000',backgroundColor:state.cardBackground,fail(){}});
  if (wx.setBackgroundColor) wx.setBackgroundColor({backgroundColor:state.pageBackground,backgroundColorTop:state.pageBackground,backgroundColorBottom:state.pageBackground,fail(){}});
  if (wx.setBackgroundTextStyle) wx.setBackgroundTextStyle({textStyle:state.isDark ? 'light' : 'dark',fail(){}});
  if (wx.setTabBarStyle) wx.setTabBarStyle({selectedColor:state.themePrimary,color:'#999999',backgroundColor:state.cardBackground,borderStyle:state.isDark ? 'white' : 'black',fail(){}});
  if (wx.setTabBarItem) ['score','playlist','add','user'].forEach((name,index) => {
    wx.setTabBarItem({index,iconPath:'images/remix/' + name + '-gray.png',selectedIconPath:'images/remix/' + name + '-' + state.themeIcon + '.png',fail(){}});
  });
}
function sync() {
  listeners.forEach(page => page.setData(data()));
  tabBar();
}
function init() {
  read();
  if (!watching && wx.onThemeChange) {
    wx.onThemeChange(({theme}) => { systemTheme = theme === 'dark' ? 'dark' : 'light'; sync(); });
    watching = true;
  }
}
function setAppearance(mode) {
  if (!appearances[mode]) return;
  wx.setStorageSync('lyra_appearance',mode);
  appearance = mode;
  sync();
}
function set(id) {
  if (!palettes[id]) return;
  wx.setStorageSync('lyra_theme', id);
  current = id;
  listeners.forEach(page => page.setData(data()));
  tabBar();
}
function page(options) {
  const { onLoad, onShow, onUnload } = options;
  return { ...options, data: { ...options.data, ...data() },
    onLoad(...args) { init(); listeners.add(this); this.setData(data()); if (onLoad) return onLoad.apply(this, args); },
    onShow(...args) { read(); this.setData(data()); tabBar(); if (onShow) return onShow.apply(this, args); },
    onUnload(...args) { listeners.delete(this); if (onUnload) return onUnload.apply(this, args); }
  };
}
function modal(options) { return wx.showModal({ confirmColor: data().themePrimary, ...options }); }
module.exports = { palettes, appearances, init, read, data, set, setAppearance, page, modal };
