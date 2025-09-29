import { mainWindow } from "@/main/windows";
import { setupTitlebar } from "custom-electron-titlebar/main";
import { Menu } from 'electron';
import process from 'process';
import '../orm/data-source';
import "./data-parser";
import "./hotkey";
import "./ipc";
import { resetAllStatCounts } from "./ipc/ipc-daidai";
import { initializeSchedulers } from "./scheduler";
import "./windows/app/auth";

async function bootstrap() {
  // 初始化环境相关
  mainWindow.initApplication()
  // 初始化主窗口
  await mainWindow.initAppWindow()

  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
  }
  // 初始化定时任务
  await initializeSchedulers();
  // 初始化统计计数（软件启动时重置计数）
  await resetAllStatCounts();
  setupTitlebar()
}

bootstrap().then()
