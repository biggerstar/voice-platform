import { globalEnv } from "@/global/global-env";
import { globalMainPathParser } from "@/global/global-main-path-parser";
import { BrowserWindow } from 'electron';
import { mainWindow } from "../app/app";
import { WindowEventManager } from './event-manager';
import { ChildWindowOptions, WindowEventType } from './types';

// 窗口管理器 - 统一管理所有窗口配置和事件
export class WindowManager {
  private static instance: WindowManager;
  private childWindows: Map<number, BrowserWindow> = new Map();
  private defaultWebPreferences: Electron.WebPreferences;
  private eventManager: WindowEventManager;
  private windowIdToOverrides: Map<number, Partial<Electron.WebPreferences>> = new Map();

  private constructor() {
    this.defaultWebPreferences = {
      spellcheck: false,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: false,
      preload: globalMainPathParser.resolvePreload('browser.cjs').toString(),
      partition: 'persist:encommerce',
    };
    this.eventManager = WindowEventManager.getInstance();
  }

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  // 创建子窗口 - 继承父配置并设置窗口开启处理器
  public createChildWindow(options: ChildWindowOptions): BrowserWindow {
    const { url, parentBounds, parentWindowId, webPreferencesOverrides } = options;
    const bounds = parentBounds || mainWindow.win.getBounds();

    const childWindow = new BrowserWindow({
      width: Math.max(1200, bounds.width - 100),
      height: Math.max(800, bounds.height - 100),
      x: bounds.x + 50,
      y: bounds.y + 50,
      minWidth: 800,
      minHeight: 600,
      show: false,
      webPreferences: {
        ...this.defaultWebPreferences,
        ...(webPreferencesOverrides || {}),
      }
    });

    // 记录该子窗口的偏好配置，供其子窗口继承
    if (webPreferencesOverrides && Object.keys(webPreferencesOverrides).length > 0) {
      this.windowIdToOverrides.set(childWindow.id, webPreferencesOverrides);
    } else if (parentWindowId && this.windowIdToOverrides.has(parentWindowId)) {
      // 继承父窗口的配置
      this.windowIdToOverrides.set(childWindow.id, this.windowIdToOverrides.get(parentWindowId)!);
    }

    // 触发创建事件
    this.eventManager.emitWindowEvent(WindowEventType.WINDOW_CREATED, {
      windowId: childWindow.id,
      window: childWindow,
      url,
      timestamp: Date.now(),
      parentWindowId
    });

    // 设置显示/隐藏事件监听
    childWindow.on('show', () => {
      this.eventManager.emitWindowEvent(WindowEventType.WINDOW_SHOWN, {
        windowId: childWindow.id,
        window: childWindow,
        timestamp: Date.now(),
        parentWindowId
      });
    });

    childWindow.on('hide', () => {
      this.eventManager.emitWindowEvent(WindowEventType.WINDOW_HIDDEN, {
        windowId: childWindow.id,
        window: childWindow,
        timestamp: Date.now(),
        parentWindowId
      });
    });

    // 为每个子窗口设置 windowOpenHandler - 解决嵌套问题
    this.setupWindowOpenHandler(childWindow);

    // 设置父子关系和事件监听
    this.setupChildWindowEvents(childWindow, parentWindowId);

    // 加载 URL
    childWindow.loadURL(url);

    // 准备好后显示
    childWindow.once('ready-to-show', () => {
      childWindow.show();
    });

    // 保存引用
    this.childWindows.set(childWindow.id, childWindow);

    return childWindow;
  }

  // 为窗口设置 windowOpenHandler - 支持无限嵌套
  private setupWindowOpenHandler(window: BrowserWindow) {
    window.webContents.setWindowOpenHandler((details) => {
      const { url, disposition } = details;

      if (disposition === 'new-window') {
        // 递归创建子窗口，传递当前窗口的边界
        const currentBounds = window.getBounds();
        const inheritedOverrides = this.windowIdToOverrides.get(window.id);
        this.createChildWindow({
          url,
          parentBounds: currentBounds,
          parentWindowId: window.id,
          webPreferencesOverrides: inheritedOverrides
        });

        return { action: 'deny' }; // 阻止默认行为，使用我们的自定义窗口
      }

      // 在当前窗口中打开
      window.webContents.loadURL(url);
      return { action: 'deny' };
    });
  }

  // 设置子窗口事件监听
  private setupChildWindowEvents(childWindow: BrowserWindow, parentWindowId?: number) {
    // 窗口关闭时清理引用并触发销毁事件
    childWindow.on('closed', () => {
      this.childWindows.delete(childWindow.id);
      this.windowIdToOverrides.delete(childWindow.id);

      // 触发销毁事件
      this.eventManager.emitWindowEvent(WindowEventType.WINDOW_DESTROYED, {
        windowId: childWindow.id,
        timestamp: Date.now(),
        parentWindowId
      });
    });

    // 继承主窗口的一些行为
    mainWindow.win.on('close', () => {
      if (!childWindow.isDestroyed()) {
        childWindow.close();
      }
    });

    // 可以添加更多事件监听
    this.setupAdditionalEvents(childWindow);
  }

  // 设置额外的事件监听 - 继承父窗口行为
  private setupAdditionalEvents(window: BrowserWindow) {
    // 防止 webview 附加
    window.webContents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });

    // 开发模式下打开开发工具
    if (globalEnv.isDev) {
      window.webContents.openDevTools();
    }

    this.setupRequestInterception(window);
  }

  // 网络请求拦截 - 可以继承父窗口的拦截规则
  private setupRequestInterception(window: BrowserWindow) {
    window.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (detail, callback) => {
        const blackList = [];

        for (const urlPart of blackList) {
          if (detail.url.includes(urlPart)) {
            callback({ cancel: true });
            return;
          }
        }
        callback({});
      }
    );

    window.webContents.session.webRequest.onHeadersReceived(
      { urls: ['http://*/*', 'https://*/*'] },
      (detail, callback) => {
        const { responseHeaders } = detail;
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['content-security-policy-report-only'];
        callback({ responseHeaders });
      }
    );
  }

  // 获取事件管理器
  public getEventManager(): WindowEventManager {
    return this.eventManager;
  }

  // 获取所有子窗口
  public getChildWindows(): BrowserWindow[] {
    return Array.from(this.childWindows.values()).filter(win => !win.isDestroyed());
  }

  // 关闭所有子窗口
  public closeAllChildWindows() {
    this.childWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.childWindows.clear();
  }

  // 获取默认 webPreferences（供其他地方使用）
  public getDefaultWebPreferences(): Electron.WebPreferences {
    return { ...this.defaultWebPreferences };
  }

  // 设置全局默认 webPreferences（不影响已创建窗口）
  public setDefaultWebPreferences(overrides: Partial<Electron.WebPreferences>) {
    this.defaultWebPreferences = {
      ...this.defaultWebPreferences,
      ...(overrides || {})
    };
  }
}
