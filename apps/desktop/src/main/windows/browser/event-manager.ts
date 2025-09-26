import { EventEmitter } from 'events';
import { WindowEventData, WindowEventListener, WindowEventType } from './types';

// 简化的事件管理器
export class WindowEventManager extends EventEmitter {
  private static instance: WindowEventManager;

  private constructor() {
    super();
  }

  public static getInstance(): WindowEventManager {
    if (!WindowEventManager.instance) {
      WindowEventManager.instance = new WindowEventManager();
    }
    return WindowEventManager.instance;
  }

  // 添加事件监听器
  public addEventListener(eventType: WindowEventType, listener: WindowEventListener): void {
    this.on(eventType, listener);
  }

  // 移除事件监听器
  public removeEventListener(eventType: WindowEventType, listener: WindowEventListener): void {
    this.off(eventType, listener);
  }

  // 触发事件
  public emitWindowEvent(eventType: WindowEventType, data: WindowEventData): void {
    this.emit(eventType, eventType, data);
  }
}
