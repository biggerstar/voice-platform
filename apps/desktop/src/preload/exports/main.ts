import { ipcRenderer } from "electron/renderer";
import { useTitlebar } from "../common/titlebar";

console.log('main preload 加载成功');

useTitlebar({
  color: '#FFFFFF',
  resetPosition: true,
  overflowHidden: true,
  titleSuffix: {
    suffix: ` 语聊管理`,
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
  async getOneAccountSession(name: string) {
    return ipcRenderer.invoke('get-one-account-session-data', name)
  },
  async updateAccountSession(id: string, data: Record<any, any> = {}) {
    return ipcRenderer.invoke('update-account-session', id, data)
  },
  async updateAccountSessionLoginStatus(name: string, loginStatus: string) {
    return ipcRenderer.invoke('update-account-session-login-status', name, loginStatus)
  },
  async deleteAccountSession(ids = {}) {
    return ipcRenderer.invoke('delete-account-session', ids)
  },
  async getDaidaiLogs(options: {
    accountSessionId?: string;
    skip?: number;
    take?: number;
    where?: Record<string, any>;
    pageSize?: number;
    currentPage?: number;
  } = {}) {
    return ipcRenderer.invoke('get-daidai-logs', options)
  },
  async updateDaidaiLog(id: string, status: string, message?: string, roomId?: string) {
    return ipcRenderer.invoke('update-daidai-log', id, status, message, roomId)
  },
  async deleteDaidaiLogs(ids: string[] = []) {
    return ipcRenderer.invoke('delete-daidai-logs', ids)
  },
  async clearAllDaidaiLogs() {
    return ipcRenderer.invoke('clear-all-daidai-logs')
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
  close(url: string) {
    return ipcRenderer.invoke('close-window', url);
  },
  getURL() {
    return ipcRenderer.invoke('get-current-url');
  },
  reopenBrowser(options: any) {
    return ipcRenderer.invoke('reopen-browser', options);
  },
  axiosRequest(config: any) {
    return ipcRenderer.invoke('axios-request', config);
  },
  startMirrorTask(options: { name: string; type: string }[] | { name: string; type: string }) {
    return ipcRenderer.invoke('start-mirror-task', options);
  },
  stopMirrorTask(viewIds?: string[]) {
    return ipcRenderer.invoke('stop-mirror-task', viewIds);
  },
  getMirrorTaskStatus() {
    return ipcRenderer.invoke('get-mirror-task-status');
  },
  reconnectRoom(options: {
    roomId: string;
    accountSessionId: string;
    chatroomName?: string;
  }) {
    return ipcRenderer.invoke('reconnect-room', options);
  }
}
window['__API__'] = __API__;

// 监听主进程消息
ipcRenderer.on("export-media-resrouce", (e, data = {}) => {
  console.log(`🚀 ~ export-media-resrouce:`, data)
  window.exportMediaResrouce(data.type, data.currentUrl, data.productId)
});
