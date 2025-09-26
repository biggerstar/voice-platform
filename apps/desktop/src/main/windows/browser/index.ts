// 导出类型定义
export * from './types';

// 导出事件管理器
export { WindowEventManager } from './event-manager';

// 导出窗口管理器
export { WindowManager } from './window-manager';

// 导出主浏览器视图
export { BrowserinternetView } from './browser-view';

// 创建并导出默认实例
import { BrowserinternetView } from './browser-view';
export const browserinternetView = new BrowserinternetView();
