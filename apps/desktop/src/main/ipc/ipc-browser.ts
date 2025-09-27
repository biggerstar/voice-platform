import { globalMainPathParser } from "@/global/global-main-path-parser";
import { ipcMain } from "electron";
import md5 from "md5";
import { browserinternetView } from "../windows/browser";

ipcMain.handle('show-window', () => {
  browserinternetView.showWindow();
})

ipcMain.handle('hide-window', () => {
  browserinternetView.hideWindow();
})

ipcMain.handle('is-window-show', () => {
  return browserinternetView.currentShowStatus();
})

ipcMain.handle('load-url', (_, url) => {
  if (browserinternetView.isRunning()) {
    browserinternetView.win.webContents.loadURL(url);
  }
})


ipcMain.handle('close-window', (_, url) => {
  if (browserinternetView.isRunning()) {
    browserinternetView.close()
  }
})

ipcMain.handle('get-current-url', (_, url) => {
  if (browserinternetView.isRunning()) {
    return browserinternetView.win.webContents.getURL()
  }
  return undefined
})

ipcMain.handle('reopen-browser', (_, options = {}) => {
  const { name, url, type } = options
  browserinternetView.reopen({
    url,
    options: {
      webPreferences: {
        preload: globalMainPathParser.resolvePreload('browser.cjs').toString(),
        partition: name ? 'persist:' + md5(String(type) + name) : 'persist:encommerce',
        additionalArguments: [
          `daidai-name=${name}`
        ]
      }
    }
  })
})
