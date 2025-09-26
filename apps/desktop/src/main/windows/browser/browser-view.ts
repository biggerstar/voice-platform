import { globalEnv } from "@/global/global-env";
import { WebContentsView } from 'electron';
import { mainWindow } from "../app/app";
import { WindowEventManager } from './event-manager';
import { BrowserViewOptions, WindowEventListener, WindowEventType } from './types';
import { WindowManager } from './window-manager';

export class BrowserinternetView {
  public win: WebContentsView | null = null;
  private eventManager: WindowEventManager;
  private windowManager: WindowManager;
  private viewOptionsOverrides: Partial<Electron.WebContentsViewConstructorOptions> | null = null;
  private currentUrl: string = 'about:blank';

  constructor() {
    this.eventManager = WindowEventManager.getInstance();
    this.windowManager = WindowManager.getInstance();
  }

  public async createWindow(isShow: boolean = true, url: string = 'about:blank', options?: Partial<Electron.WebContentsViewConstructorOptions>) {
    this.currentUrl = url || 'about:blank';
    if (options) {
      this.viewOptionsOverrides = { ...(this.viewOptionsOverrides || {}), ...options };
    }
    if (this.win && this.win.webContents && !this.win.webContents.isDestroyed()) {
      return;
    }

    const webPreferences = this.windowManager.getDefaultWebPreferences();

    const baseOptions: Electron.WebContentsViewConstructorOptions = {
      webPreferences
    };
    const overrides = this.viewOptionsOverrides || {};
    const mergedOptions: Electron.WebContentsViewConstructorOptions = {
      ...baseOptions,
      ...overrides,
      webPreferences: {
        ...baseOptions.webPreferences,
        ...(overrides.webPreferences || {})
      }
    };

    this.win = new WebContentsView(mergedOptions);
    mainWindow.win.contentView.addChildView(this.win);
    this.win.webContents.setBackgroundThrottling(false);
    console.log('已成功创建 浏览器 窗口!');

    // 触发创建事件
    this.eventManager.emitWindowEvent(WindowEventType.WINDOW_CREATED, {
      windowId: this.win.webContents.id,
      window: this.win,
      url: this.currentUrl,
      timestamp: Date.now()
    });

    this.followResize(isShow);
    this.win.webContents.loadURL(this.currentUrl);
    this.win.webContents.setAudioMuted(true);

    if (globalEnv.isDev) {
      this.win.webContents.openDevTools();
    }

    // 设置窗口开启处理器 - 使用窗口管理器
    this.setupWindowOpenHandler();

    // 设置事件监听
    this.setupEventListeners();

    // 设置网络拦截
    this.interceptRequest();
  }

  // 使用窗口管理器处理窗口开启
  private setupWindowOpenHandler() {
    if (!this.win) return;

    this.win.webContents.setWindowOpenHandler((details) => {
      const { url, disposition } = details;

      if (disposition === 'new-window') {
        // 使用窗口管理器创建新窗口
        const childWebPreferencesOverrides = (this.viewOptionsOverrides && this.viewOptionsOverrides.webPreferences) ? this.viewOptionsOverrides.webPreferences : undefined;
        this.windowManager.createChildWindow({
          url,
          parentWindowId: this.win!.webContents.id,
          webPreferencesOverrides: childWebPreferencesOverrides
        });
        return { action: 'deny' };
      }

      // 在当前 view 中打开
      this.win!.webContents.loadURL(url);
      return { action: 'deny' };
    });
  }

  // 设置事件监听器
  private setupEventListeners() {
    if (!this.win) return;

    // 防止 webview 附加
    this.win.webContents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });

    // 窗口大小变化监听
    mainWindow.win.addListener('resize', () => this.followResize(true));

    // 窗口关闭监听
    mainWindow.win.addListener('close', () => {
      this.close();
    });
  }

  private followResize(isShow: boolean = true, x: number = 0, y: number = 0) {
    if (!this.win || !this.win.webContents) return;

    const bounds = mainWindow.win.getBounds();
    const windowId = this.win.webContents.id;

    this.win.setVisible(isShow);

    if (isShow) {
      this.win.setBounds({
        x: x + 80,
        y: 28,
        width: bounds.width - 80,
        height: bounds.height - 28
      });

      // 触发显示事件
      this.eventManager.emitWindowEvent(WindowEventType.WINDOW_SHOWN, {
        windowId,
        window: this.win,
        timestamp: Date.now()
      });
    } else {
      // 触发隐藏事件
      this.eventManager.emitWindowEvent(WindowEventType.WINDOW_HIDDEN, {
        windowId,
        window: this.win,
        timestamp: Date.now()
      });
    }
  }

  private interceptRequest() {
    if (!this.win) return;
    this.win.webContents.session.webRequest.onHeadersReceived(
      { urls: ['http://*/*', 'https://*/*'] },
      (detail, callback) => {
        const { responseHeaders } = detail;
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['content-security-policy-report-only'];
        callback({ responseHeaders });
      }
    );
  }

  public isRunning(): boolean {
    if (!this.win) return false;
    return !this.win.webContents?.isDestroyed();
  }

  public currentShowStatus(): boolean {
    if (!this.win) return false;
    if (this.win.webContents && this.win.webContents.isDestroyed()) return false;
    return this.win.getVisible();
  }

  public hideWindow(): boolean {
    if (this.win && this.isRunning() && this.win.webContents && !this.win.webContents.isDestroyed()) {
      try {
        this.followResize(false);
        return true;
      } catch (error) {
        console.error("浏览器隐藏窗口失败:", error);
      }
    } else {
      console.log("浏览器窗口不存在或未运行");
    }
    return false;
  }

  public showWindow(): boolean {
    if (this.win && this.isRunning() && this.win.webContents && !this.win.webContents.isDestroyed()) {
      try {
        this.followResize();
        return true;
      } catch (error) {
        console.error("显示TK窗口失败:", error);
      }
    } else {
      this.createWindow(true, this.currentUrl);
    }
    return true;
  }

  public close() {
    // 关闭所有子窗口
    this.windowManager.closeAllChildWindows();

    // 清理主视图
    if (this.win && this.win.webContents) {
      const windowId = this.win.webContents.id;

      this.win.webContents.close();
      mainWindow.win.contentView.removeChildView(this.win);

      // 触发销毁事件
      this.eventManager.emitWindowEvent(WindowEventType.WINDOW_DESTROYED, {
        windowId,
        timestamp: Date.now()
      });

      this.win = null;
    }

    console.log("已关闭浏览器视图");
  }

  public async open(params?: BrowserViewOptions) {
    const show = params?.show ?? true;
    const url = params?.url ?? this.currentUrl ?? 'about:blank';
    const options = params?.options;
    if (this.isRunning()) return;
    await this.createWindow(show, url, options);
  }

  public async reopen(params?: BrowserViewOptions) {
    const show = params?.show ?? true;
    const url = params?.url ?? this.currentUrl ?? 'about:blank';
    const options = params?.options;
    this.close();
    await this.createWindow(show, url, options);
  }

  // 设置 View 构造参数覆盖（仅存储，不立即重启）
  public configure(options: Partial<Electron.WebContentsViewConstructorOptions> | null) {
    this.viewOptionsOverrides = options ? { ...(this.viewOptionsOverrides || {}), ...options } : null;
  }

  // 事件监听方法
  public addEventListener(eventType: WindowEventType, listener: WindowEventListener): void {
    this.eventManager.addEventListener(eventType, listener);
  }

  public removeEventListener(eventType: WindowEventType, listener: WindowEventListener): void {
    this.eventManager.removeEventListener(eventType, listener);
  }

  // 获取所有子窗口
  public getChildWindows() {
    return this.windowManager.getChildWindows();
  }

  // 关闭所有子窗口
  public closeAllChildWindows() {
    this.windowManager.closeAllChildWindows();
  }
}
