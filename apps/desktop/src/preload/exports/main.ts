import { ipcRenderer } from "electron/renderer";
import { useTitlebar } from "../common/titlebar";

console.log('main preload 加载成功');

useTitlebar({
  color: '#FFFFFF',
  resetPosition: true,
  overflowHidden: true,
  titleSuffix: {
    suffix: ` FLJ内部使用-淘宝1688爬取信息`,
    showVersion: false,
    separator: ' - ',
  }
})

const __API__ = {
  async login(options = {}) {
    return ipcRenderer.invoke('login', options)
  },
  async getPruductList(options = {}) {
    return ipcRenderer.invoke('get-product-data', options)
  },
  async getOneList(options = {}) {
    return ipcRenderer.invoke('get-one-product', options)
  },
  async deleteProduct(ids = {}) {
    return ipcRenderer.invoke('delete-product', ids)
  },
  async updateProduct(id: string, data: Record<any, any> = {}) {
    return ipcRenderer.invoke('update-product', id, data)
  },
  async createAccountSession(data = {}) {
    return ipcRenderer.invoke('create-account-session', data)
  },
  async getAccountSessionList(options = {}) {
    return ipcRenderer.invoke('get-account-session-data', options)
  },
  async updateAccountSession(id: string, data: Record<any, any> = {}) {
    return ipcRenderer.invoke('update-account-session', id, data)
  },
  async deleteAccountSession(ids = {}) {
    return ipcRenderer.invoke('delete-account-session', ids)
  },
  showWindow() {
    return ipcRenderer.invoke('show-window');
  },
  hideWindow() {
    return ipcRenderer.invoke('hide-window');
  },
  isShow() {
    return ipcRenderer.invoke('is-window-show');
  },
  loadURL(url: string) {
    return ipcRenderer.invoke('load-url', url);
  },
  getURL() {
    return ipcRenderer.invoke('get-current-url');
  },
  reopenBrowser(options: any) {
    return ipcRenderer.invoke('reopen-browser', options);
  }
}
window['__API__'] = __API__;

// 监听主进程消息
ipcRenderer.on("export-media-resrouce", (e, data = {}) => {
  console.log(`🚀 ~ export-media-resrouce:`, data)
  window.exportMediaResrouce(data.type, data.currentUrl, data.productId)
});
