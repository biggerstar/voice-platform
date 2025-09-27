interface IframeBrowserOptions {
  sandbox?: string;
  allowScripts?: boolean;
  style?: Partial<CSSStyleDeclaration>;
  attributes?: Record<string, string>;
  autoExecute?: boolean;
  allowSameOrigin?: boolean;
  visible?: boolean;
  position?: {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
  };
  size?: {
    width?: string | number;
    height?: string | number;
  };
}

export class IframeBrowser {
  private iframe: HTMLIFrameElement | null = null;
  private isDestroyed: boolean = false;
  private loadPromise: Promise<HTMLIFrameElement> | null = null;
  private currentUrl: string = 'about:blank';
  private options: Required<IframeBrowserOptions>;

  constructor(options: IframeBrowserOptions = {}) {
    const defaultSandbox = options.allowSameOrigin !== false ?
      'allow-scripts allow-same-origin' : 'allow-scripts';

    // 默认样式：隐藏、固定定位、合适的大小
    const defaultStyle: Partial<CSSStyleDeclaration> = {
      display: 'none',
      position: 'fixed',
      border: 'none',
      zIndex: '9999',
      ...options.style
    };

    // 设置默认位置和大小
    if (options.position) {
      if (options.position.top !== undefined) defaultStyle.top = typeof options.position.top === 'number' ? `${options.position.top}px` : options.position.top;
      if (options.position.right !== undefined) defaultStyle.right = typeof options.position.right === 'number' ? `${options.position.right}px` : options.position.right;
      if (options.position.bottom !== undefined) defaultStyle.bottom = typeof options.position.bottom === 'number' ? `${options.position.bottom}px` : options.position.bottom;
      if (options.position.left !== undefined) defaultStyle.left = typeof options.position.left === 'number' ? `${options.position.left}px` : options.position.left;
    } else {
      // 默认位置：右上角
      defaultStyle.top = '10px';
      defaultStyle.right = '10px';
    }

    if (options.size) {
      if (options.size.width !== undefined) defaultStyle.width = typeof options.size.width === 'number' ? `${options.size.width}px` : options.size.width;
      if (options.size.height !== undefined) defaultStyle.height = typeof options.size.height === 'number' ? `${options.size.height}px` : options.size.height;
    } else {
      // 默认大小
      defaultStyle.width = '300px';
      defaultStyle.height = '200px';
    }

    this.options = {
      sandbox: options.sandbox || defaultSandbox,
      allowScripts: options.allowScripts !== false,
      style: defaultStyle as Partial<CSSStyleDeclaration>,
      attributes: options.attributes || {},
      autoExecute: options.autoExecute !== false,
      allowSameOrigin: options.allowSameOrigin !== false,
      visible: options.visible || false,
      position: options.position || { top: 10, right: 10 },
      size: options.size || { width: 300, height: 200 }
    };
  }

  /**
   * 创建并加载空白 iframe
   */
  async create(): Promise<HTMLIFrameElement> {
    if (this.isDestroyed) {
      throw new Error('Cannot create iframe: instance has been destroyed');
    }

    if (this.iframe) {
      return this.iframe;
    }

    this.iframe = document.createElement('iframe');

    // 设置 iframe 属性
    Object.assign(this.iframe.style, this.options.style);
    this.iframe.sandbox = this.options.sandbox;
    this.iframe.src = 'about:blank';

    // 设置自定义属性
    Object.entries(this.options.attributes).forEach(([key, value]) => {
      this.iframe?.setAttribute(key, value);
    });

    // 添加到文档
    document.body.appendChild(this.iframe);

    // 根据可见性设置显示状态
    if (this.options.visible) {
      this.show();
    }

    // 等待 iframe 加载完成
    this.loadPromise = new Promise<HTMLIFrameElement>((resolve, reject) => {
      if (!this.iframe) {
        reject(new Error('Iframe element is null'));
        return;
      }

      this.iframe.onload = () => {
        this.currentUrl = this.iframe?.src || 'about:blank';
        resolve(this.iframe!);
      };

      this.iframe.onerror = (error) => reject(new Error(`Iframe failed to load: ${error}`));

      // 设置超时处理
      setTimeout(() => {
        if (this.iframe?.contentDocument?.readyState === 'complete') {
          this.currentUrl = this.iframe?.src || 'about:blank';
          resolve(this.iframe);
        } else {
          reject(new Error('Iframe loading timeout'));
        }
      }, 10000);
    });

    return this.loadPromise;
  }

  /**
   * 设置 iframe 位置
   */
  setPosition(position: { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number }): void {
    if (!this.iframe) return;

    if (position.top !== undefined) {
      this.iframe.style.top = typeof position.top === 'number' ? `${position.top}px` : position.top;
    }
    if (position.right !== undefined) {
      this.iframe.style.right = typeof position.right === 'number' ? `${position.right}px` : position.right;
    }
    if (position.bottom !== undefined) {
      this.iframe.style.bottom = typeof position.bottom === 'number' ? `${position.bottom}px` : position.bottom;
    }
    if (position.left !== undefined) {
      this.iframe.style.left = typeof position.left === 'number' ? `${position.left}px` : position.left;
    }
  }

  /**
   * 设置 iframe 大小
   */
  setSize(size: { width?: string | number; height?: string | number }): void {
    if (!this.iframe) return;

    if (size.width !== undefined) {
      this.iframe.style.width = typeof size.width === 'number' ? `${size.width}px` : size.width;
    }
    if (size.height !== undefined) {
      this.iframe.style.height = typeof size.height === 'number' ? `${size.height}px` : size.height;
    }
  }

  /**
   * 获取当前位置
   */
  getPosition(): { top: string; right: string; bottom: string; left: string } {
    if (!this.iframe) {
      return { top: '', right: '', bottom: '', left: '' };
    }

    return {
      top: this.iframe.style.top,
      right: this.iframe.style.right,
      bottom: this.iframe.style.bottom,
      left: this.iframe.style.left
    };
  }

  /**
   * 获取当前大小
   */
  getSize(): { width: string; height: string } {
    if (!this.iframe) {
      return { width: '', height: '' };
    }

    return {
      width: this.iframe.style.width,
      height: this.iframe.style.height
    };
  }

  /**
   * 导航到指定 URL
   */
  async goto(url: string): Promise<void> {
    await this.ensureIframeReady();

    if (!this.iframe) {
      throw new Error('Iframe is not available');
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.iframe) {
        reject(new Error('Iframe is not available'));
        return;
      }

      const onLoad = () => {
        this.iframe?.removeEventListener('load', onLoad);
        this.currentUrl = url;
        resolve();
      };

      const onError = (error: Event | string) => {
        this.iframe?.removeEventListener('error', onError);
        reject(new Error(`Failed to navigate to ${url}: ${error}`));
      };

      this.iframe.addEventListener('load', onLoad);
      this.iframe.addEventListener('error', onError);

      this.iframe.src = url;

      // 设置导航超时
      setTimeout(() => {
        this.iframe?.removeEventListener('load', onLoad);
        this.iframe?.removeEventListener('error', onError);
        reject(new Error(`Navigation to ${url} timed out`));
      }, 30000);
    });
  }

  /**
   * 仅在目标与当前地址不同时才导航
   * @param url 目标完整 URL
   * @returns 是否真正触发了加载
   */
  async gotoIfNeeded(url: string): Promise<boolean> {
    await this.ensureIframeReady();

    if (!this.iframe) {
      throw new Error('Iframe is not available');
    }

    // 解析当前地址
    const current = new URL(this.currentUrl);
    // 解析目标地址
    const target = new URL(url);

    // 如果 origin 和 pathname 都一致，则跳过
    if (current.origin === target.origin && current.pathname === target.pathname) {
      return false; // 未触发加载
    }

    // 真正导航
    await this.goto(url);
    return true;    // 已触发加载
  }

  /**
   * 获取 iframe 的 window 对象（确保已加载完成）
   */
  async getIframeWindow(): Promise<Window> {
    await this.ensureIframeReady();

    const iframeWindow = this.iframe?.contentWindow;
    if (!iframeWindow) {
      throw new Error('Iframe window is not available');
    }

    return iframeWindow;
  }

  /**
   * 获取 iframe 的 document 对象（确保已加载完成）
   */
  async getIframeDocument(): Promise<Document> {
    await this.ensureIframeReady();

    const iframeDocument = this.iframe?.contentDocument;
    if (!iframeDocument) {
      throw new Error('Iframe document is not available');
    }

    return iframeDocument;
  }

  /**
   * 获取当前 URL
   */
  getCurrentUrl(): string {
    return this.currentUrl;
  }

  /**
   * 在 iframe 中执行代码
   */
  async executeCode<T>(code: string, args: any[] = []): Promise<T> {
    const iframeWindow = await this.getIframeWindow();

    try {
      const argNames = args.map((_, i) => `arg${i}`);
      const func = new (iframeWindow as any).Function(...argNames, code);
      return func(...args) as T;
    } catch (error) {
      throw new Error(`Failed to execute code in iframe: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 注入并立即执行函数
   */
  async injectAndExecuteFunction<T>(fn: Function, ...args: any[]): Promise<T> {
    const functionString = fn.toString();
    const callString = `(${functionString})(${args.map(arg => JSON.stringify(arg)).join(',')});`;

    return this.executeCode<T>(callString);
  }

  /**
   * 注入并立即执行异步函数
   */
  async injectAndExecuteAsyncFunction<T>(fn: Function, ...args: any[]): Promise<T> {
    const functionString = fn.toString();
    const callString = `
      return (async function() {
        const result = (${functionString})(${args.map(arg => JSON.stringify(arg)).join(',')});
        return await result;
      })();
    `;

    return this.executeCode<T>(callString);
  }

  /**
   * 注入脚本并立即执行
   */
  async injectAndExecuteScript(scriptCode: string): Promise<void> {
    const iframeDocument = await this.getIframeDocument();

    const immediateScript = `
      (function() {
        ${scriptCode}
      })();
    `;

    const script = iframeDocument.createElement('script');
    script.textContent = immediateScript;

    return new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = (error) => reject(new Error(`Script execution failed: ${error}`));

      iframeDocument.head.appendChild(script);
      resolve();
    });
  }

  /**
   * 注入函数到全局作用域
   */
  async injectFunction(name: string, fn: Function): Promise<void> {
    const functionString = fn.toString();
    const scriptCode = `window.${name} = ${functionString};`;

    await this.injectAndExecuteScript(scriptCode);
  }

  /**
   * 注入多个函数到全局作用域
   */
  async injectFunctions(functions: Record<string, Function>): Promise<void> {
    const scriptCode = Object.entries(functions)
      .map(([name, fn]) => `window.${name} = ${fn.toString()};`)
      .join('\n');

    await this.injectAndExecuteScript(scriptCode);
  }

  /**
   * 在 iframe 中注入样式
   */
  async injectStyle(styleCode: string): Promise<void> {
    const iframeDocument = await this.getIframeDocument();

    const style = iframeDocument.createElement('style');
    style.textContent = styleCode;
    iframeDocument.head.appendChild(style);
  }

  /**
   * 显示 iframe
   */
  show(): void {
    if (this.iframe) {
      this.iframe.style.display = 'block';
    }
  }

  /**
   * 隐藏 iframe
   */
  hide(): void {
    if (this.iframe) {
      this.iframe.style.display = 'none';
    }
  }

  /**
   * 切换 iframe 显示状态
   */
  toggle(): void {
    if (this.iframe) {
      if (this.iframe.style.display === 'none') {
        this.show();
      } else {
        this.hide();
      }
    }
  }

  /**
   * 检查 iframe 是否可见
   */
  isVisible(): boolean {
    return this.iframe ? this.iframe.style.display !== 'none' : false;
  }

  /**
   * 销毁 iframe 并清理资源
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }

    this.iframe = null;
    this.loadPromise = null;
    this.currentUrl = 'about:blank';
  }

  /**
   * 检查 iframe 是否已被销毁
   */
  getIsDestroyed(): boolean {
    return this.isDestroyed;
  }

  /**
   * 获取 iframe 元素
   */
  getIframe(): HTMLIFrameElement | null {
    return this.iframe;
  }

  /**
   * 确保 iframe 已准备就绪
   */
  public async ensureIframeReady(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Iframe has been destroyed');
    }

    if (!this.iframe) {
      await this.create();
    } else if (this.loadPromise) {
      await this.loadPromise;
    }
  }
}
