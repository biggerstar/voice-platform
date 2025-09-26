type RequestHeaders = Record<string, string>;

interface RequestConfig {
  method: string;
  url: string;
  headers?: RequestHeaders;
  body?: any;
  async?: boolean;
  user?: string;
  password?: string;
  xhr?: XMLHttpRequest;
  init?: RequestInit;
  input?: RequestInfo | URL;
  timeout?: number;
}

interface ResponseConfig {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
  request?: XMLHttpRequest;
  response?: Response;
}

type RequestInterceptorFn = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptorFn = (response: ResponseConfig) => ResponseConfig | Promise<ResponseConfig>;
type ErrorInterceptorFn = (error: any) => any;

interface InterceptorConfig {
  fulfilled?: RequestInterceptorFn | ResponseInterceptorFn;
  rejected?: ErrorInterceptorFn;
}

class HttpInterceptor {
  private requestInterceptors: InterceptorConfig[] = [];
  private responseInterceptors: InterceptorConfig[] = [];

  private originalXHR: typeof XMLHttpRequest;
  private originalFetch: typeof fetch;
  private isActive = false;

  constructor() {
    // 保存原始 fetch 并绑定 window 上下文
    this.originalXHR = window.XMLHttpRequest;
    this.originalFetch = window.fetch.bind(window);
    this.isActive = false;
  }

  public activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.patchXMLHttpRequest();
    this.patchFetch();
  }

  public deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.restoreXMLHttpRequest();
    this.restoreFetch();
  }

  public onRequest(
    fulfilled?: RequestInterceptorFn,
    rejected?: ErrorInterceptorFn
  ): number {
    const id = this.requestInterceptors.length;
    this.requestInterceptors.push({ fulfilled, rejected });
    return id;
  }

  public onResponse(
    fulfilled?: ResponseInterceptorFn,
    rejected?: ErrorInterceptorFn
  ): number {
    const id = this.responseInterceptors.length;
    this.responseInterceptors.push({ fulfilled, rejected });
    return id;
  }

  public ejectRequest(id: number): void {
    if (this.requestInterceptors[id]) {
      this.requestInterceptors[id] = {};
    }
  }

  public ejectResponse(id: number): void {
    if (this.responseInterceptors[id]) {
      this.responseInterceptors[id] = {};
    }
  }

  private async runRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let currentConfig: RequestConfig = config;

    for (const interceptor of this.requestInterceptors) {
      if (interceptor.fulfilled) {
        try {
          const result = await interceptor.fulfilled(currentConfig);
          if (result) currentConfig = result;
        } catch (error) {
          if (interceptor.rejected) {
            return interceptor.rejected(error);
          }
          throw error;
        }
      }
    }

    return currentConfig;
  }

  private async runResponseInterceptors(response: ResponseConfig): Promise<ResponseConfig> {
    let currentResponse = response;

    for (const interceptor of this.responseInterceptors) {
      if (interceptor.fulfilled) {
        try {
          const result = await interceptor.fulfilled(currentResponse);
          if (result) currentResponse = result;
        } catch (error) {
          if (interceptor.rejected) {
            return interceptor.rejected(error);
          }
          throw error;
        }
      }
    }

    return currentResponse;
  }

  private patchXMLHttpRequest(): void {
    const self = this;

    function PatchedXMLHttpRequest(this: any) {
      const xhr = new self.originalXHR();
      const xhrData = {
        method: '',
        url: '',
        headers: {} as RequestHeaders,
        body: null,
        async: true,
        user: undefined,
        password: undefined
      };

      const handler = {
        get(target: XMLHttpRequest, prop: string | symbol) {
          const value = (target as any)[prop];

          if (prop === 'open') {
            return function (method: string, url: string, async = true, user?: string, password?: string) {
              xhrData.method = method;
              xhrData.url = url;
              xhrData.async = async;
              xhrData.user = user;
              xhrData.password = password;
              return target.open.call(target, method, url, async, user, password);
            };
          }

          if (prop === 'setRequestHeader') {
            return function (header: string, value: string) {
              xhrData.headers[header] = value;
              return target.setRequestHeader.call(target, header, value);
            };
          }

          if (prop === 'send') {
            return async function (body?: any) {
              xhrData.body = body;

              const requestConfig: RequestConfig = {
                method: xhrData.method,
                url: xhrData.url,
                headers: { ...xhrData.headers },
                body: xhrData.body,
                async: xhrData.async,
                user: xhrData.user,
                password: xhrData.password,
                xhr: target
              };

              try {
                const modifiedConfig = await self.runRequestInterceptors(requestConfig);

                if (modifiedConfig.url !== requestConfig.url || modifiedConfig.method !== requestConfig.method) {
                  target.open(
                    modifiedConfig.method,
                    modifiedConfig.url,
                    modifiedConfig.async ?? true,
                    modifiedConfig.user,
                    modifiedConfig.password
                  );
                }

                if (modifiedConfig.headers && JSON.stringify(modifiedConfig.headers) !== JSON.stringify(requestConfig.headers)) {
                  Object.entries(modifiedConfig.headers).forEach(([key, value]) => {
                    target.setRequestHeader(key, value);
                  });
                }

                const originalOnReadyStateChange = target.onreadystatechange;
                target.onreadystatechange = function () {
                  if (target.readyState === 4) {
                    self.handleXHRResponse(target, modifiedConfig).catch(console.error);
                  }
                  if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.call(target);
                  }
                };

                return target.send.call(target, modifiedConfig.body);
              } catch (error) {
                console.error('Request interceptor error:', error);
                return target.send.call(target, body);
              }
            };
          }

          if (typeof value === 'function') {
            return value.bind(target);
          }

          return value;
        },

        set(target: XMLHttpRequest, prop: string | symbol, value: any) {
          (target as any)[prop] = value;
          return true;
        }
      };

      return new Proxy(xhr, handler);
    }

    Object.setPrototypeOf(PatchedXMLHttpRequest.prototype, this.originalXHR.prototype);
    Object.setPrototypeOf(PatchedXMLHttpRequest, this.originalXHR);

    Object.getOwnPropertyNames(this.originalXHR).forEach(prop => {
      if (prop !== 'length' && prop !== 'name' && prop !== 'prototype') {
        try {
          (PatchedXMLHttpRequest as any)[prop] = (this.originalXHR as any)[prop];
        } catch (e) {
          // 忽略无法复制的属性
        }
      }
    });

    window.XMLHttpRequest = PatchedXMLHttpRequest as any;
  }

  private async handleXHRResponse(xhr: XMLHttpRequest, config: RequestConfig): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      const headersStr = xhr.getAllResponseHeaders();

      headersStr.split('\r\n').forEach(line => {
        const [key, ...valueParts] = line.split(': ');
        if (key && valueParts.length > 0) {
          headers[key.toLowerCase()] = valueParts.join(': ');
        }
      });

      let responseData = xhr.response;

      if (typeof responseData === 'string') {
        const contentType = headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            responseData = JSON.parse(responseData);
          } catch (e) {
            // 保持原始字符串
          }
        }
      }

      const responseConfig: ResponseConfig = {
        data: responseData,
        status: xhr.status,
        statusText: xhr.statusText,
        headers,
        config,
        request: xhr
      };

      await this.runResponseInterceptors(responseConfig);
    } catch (error) {
      console.error('Response interceptor error:', error);
    }
  }

  private patchFetch(): void {
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      try {
        const url = typeof input === 'string' ? input :
                    input instanceof URL ? input.toString() :
                    input instanceof Request ? input.url : String(input);

        const method = init?.method || (input instanceof Request ? input.method : 'GET');
        const headers: RequestHeaders = {};

        const processHeaders = (headerSource: any) => {
          if (!headerSource) return;

          if (headerSource instanceof Headers) {
            headerSource.forEach((value, key) => {
              headers[key] = value;
            });
          } else if (Array.isArray(headerSource)) {
            headerSource.forEach(([key, value]) => {
              headers[key] = value;
            });
          } else if (typeof headerSource === 'object') {
            Object.entries(headerSource).forEach(([key, value]) => {
              headers[key] = String(value);
            });
          }
        };

        if (input instanceof Request) {
          processHeaders(input.headers);
        }

        if (init?.headers) {
          processHeaders(init.headers);
        }

        const body = init?.body || (input instanceof Request ? await input.clone().text() : undefined);

        const requestConfig: RequestConfig = {
          method,
          url,
          headers,
          body,
          init,
          input
        };

        const modifiedConfig = await self.runRequestInterceptors(requestConfig);

        const newInit: RequestInit = {
          ...init,
          method: modifiedConfig.method,
          headers: modifiedConfig.headers,
          body: modifiedConfig.body
        };

        const response = await self.originalFetch(modifiedConfig.url, newInit);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let responseData: any;
        const contentType = response.headers.get('content-type') || '';
        const clonedResponse = response.clone();

        try {
          if (contentType.includes('application/json')) {
            responseData = await clonedResponse.json();
          } else if (contentType.includes('text/') || contentType.includes('application/xml')) {
            responseData = await clonedResponse.text();
          } else if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
            responseData = await clonedResponse.arrayBuffer();
          } else {
            responseData = await clonedResponse.text();
          }
        } catch (e) {
          responseData = null;
        }

        const responseConfig: ResponseConfig = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          config: modifiedConfig,
          response
        };

        const modifiedResponse = await self.runResponseInterceptors(responseConfig);

        let newBody: BodyInit;
        if (modifiedResponse.data !== responseData) {
          if (typeof modifiedResponse.data === 'object' && modifiedResponse.data !== null) {
            newBody = JSON.stringify(modifiedResponse.data);
            modifiedResponse.headers['content-type'] = 'application/json';
          } else {
            newBody = String(modifiedResponse.data);
          }

          return new Response(newBody, {
            status: modifiedResponse.status,
            statusText: modifiedResponse.statusText,
            headers: modifiedResponse.headers
          });
        }

        return response;
      } catch (error) {
        console.error('Fetch interceptor error:', error);
        return self.originalFetch(input, init);
      }
    };
  }

  private restoreXMLHttpRequest(): void {
    window.XMLHttpRequest = this.originalXHR;
  }

  private restoreFetch(): void {
    window.fetch = this.originalFetch.bind(window);
  }
}

// 导出单例实例
export const httpInterceptor = new HttpInterceptor();
