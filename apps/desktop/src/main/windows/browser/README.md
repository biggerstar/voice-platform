# Browser 模块化架构

## 概述

浏览器功能已重构为模块化架构，支持配置继承和事件管理。

## 文件结构

```
@browser/
├── types.ts              # 类型定义
├── event-manager.ts      # 事件管理器
├── window-manager.ts     # 窗口管理器
├── browser-view.ts       # 主浏览器视图
├── index.ts             # 统一导出
└── browser.ts           # 向后兼容的重新导出
```

## 核心模块

### 1. 类型定义 (`types.ts`)
- `WindowEventType`: 窗口事件类型枚举
- `WindowEventData`: 窗口事件数据结构
- `WindowEventListener`: 事件监听器接口
- `BrowserViewOptions`: 浏览器视图配置选项
- `ChildWindowOptions`: 子窗口创建选项

### 2. 事件管理器 (`event-manager.ts`)
- 单例模式的事件管理器
- 支持窗口创建、销毁、显示、隐藏事件
- 提供事件监听和触发机制

### 3. 窗口管理器 (`window-manager.ts`)
- 管理所有子窗口的创建和生命周期
- 支持配置继承：子窗口自动继承父窗口的 `webPreferences`
- 处理窗口嵌套和事件传播
- 网络请求拦截和 CSP 处理

### 4. 浏览器视图 (`browser-view.ts`)
- 主 `WebContentsView` 的管理
- 支持运行时配置更新
- 提供 `open`、`close`、`reopen`、`configure` 等 API
- 保持向后兼容性

## 配置继承机制

### 主视图配置
```typescript
// 设置配置（不立即重启）
browserinternetView.configure({
  webPreferences: {
    partition: 'persist:accountA',
    preload: '/path/to/preload.cjs'
  }
});

// 重启生效
await browserinternetView.reopen();
```

### 子窗口继承
- 通过 `Shift + 鼠标左键` 或 `window.open()` 创建的新窗口
- 自动继承父窗口的 `webPreferences` 配置
- 支持多级嵌套继承

## API 使用示例

### 基本操作
```typescript
import { browserinternetView } from './browser';

// 打开浏览器视图
await browserinternetView.open({
  show: true,
  url: 'https://example.com',
  options: {
    webPreferences: {
      partition: 'persist:session1'
    }
  }
});

// 配置更新
browserinternetView.configure({
  webPreferences: {
    partition: 'persist:session2'
  }
});

// 重启生效
await browserinternetView.reopen();

// 关闭
browserinternetView.close();
```

### 事件监听
```typescript
import { WindowEventType } from './browser';

browserinternetView.addEventListener(WindowEventType.WINDOW_CREATED, (eventType, data) => {
  console.log('窗口已创建:', data.windowId, data.url);
});
```

### 子窗口管理
```typescript
// 获取所有子窗口
const childWindows = browserinternetView.getChildWindows();

// 关闭所有子窗口
browserinternetView.closeAllChildWindows();
```

## 向后兼容性

- 原有的 `startTask()`、`stopTask()`、`restartTask()` 方法仍然可用（标记为废弃）
- 所有现有导入路径保持不变
- 新功能通过 `open()`、`close()`、`reopen()`、`configure()` 提供

## 优势

1. **模块化**: 功能分离，职责清晰
2. **配置继承**: 子窗口自动继承父窗口配置
3. **事件驱动**: 统一的事件管理机制
4. **类型安全**: 完整的 TypeScript 类型定义
5. **向后兼容**: 不影响现有代码
6. **可扩展**: 易于添加新功能和配置选项
