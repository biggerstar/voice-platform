import { BrowserWindow, WebContentsView } from 'electron';

// 窗口事件类型
export enum WindowEventType {
  WINDOW_CREATED = 'window:created',
  WINDOW_DESTROYED = 'window:destroyed',
  WINDOW_SHOWN = 'window:shown',
  WINDOW_HIDDEN = 'window:hidden'
}

// 窗口事件数据
export interface WindowEventData {
  windowId: number;
  window?: BrowserWindow | WebContentsView;
  url?: string;
  timestamp: number;
  parentWindowId?: number;
}

// 窗口事件监听器
export interface WindowEventListener {
  (eventType: WindowEventType, data: WindowEventData): void;
}

// 浏览器视图配置选项
export interface BrowserViewOptions {
  show?: boolean;
  url?: string;
  options?: Partial<Electron.WebContentsViewConstructorOptions>;
}

// 子窗口创建选项
export interface ChildWindowOptions {
  url: string;
  parentBounds?: Electron.Rectangle;
  parentWindowId?: number;
  webPreferencesOverrides?: Partial<Electron.WebPreferences>;
}
