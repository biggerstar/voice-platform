import { browserinternetView, mainWindow, WindowEventType } from "../windows";

browserinternetView.addEventListener(WindowEventType.WINDOW_CREATED, (eventType, data) => {
  const window = data.window
  if (!window) return
  
  // 监听来自浏览器窗口的导出媒体资源事件
  window.webContents.on('ipc-message', (event, channel, ...args) => {
    if (channel === 'export-media-resrouce-from-browser') {
      const [data] = args;
      if (mainWindow && mainWindow.win.webContents) {
        mainWindow.win.webContents.send('export-media-resrouce', data);
      }
    }
  });
});
