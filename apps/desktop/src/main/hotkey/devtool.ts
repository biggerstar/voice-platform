import { app, globalShortcut } from 'electron'
import { mainWindow } from '../windows'

app.whenReady().then(() => {
  // 注册全局快捷键
  const ret = globalShortcut.register('CommandOrControl+T', () => {
    mainWindow.win.webContents.openDevTools()
  })

  if (!ret) {
    console.error('注册 快捷键 CommandOrControl+I 失败')
  } else {
    console.log('注册 快捷键 CommandOrControl+I 成功')
  }
})


app.whenReady().then(() => {
  // 注册全局快捷键
  const ret = globalShortcut.register('CommandOrControl+K', () => {
    mainWindow.win.webContents.openDevTools()
  })

  if (!ret) {
    console.error('注册 快捷键 CommandOrControl+I 失败')
  } else {
    console.log('注册 快捷键 CommandOrControl+I 成功')
  }
})
