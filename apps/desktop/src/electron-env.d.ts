/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG?: 'true';
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬ dist-electron
     * │ ├─┬ main
     * │ │ └── index.js    > Electron-Main
     * │ └─┬ preload
     * │   └── index.mjs   > Preload-Scripts
     * ├─┬ dist
     * │ └── index.html    > Electron-Renderer
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    APP_PUBLIC: string;
    WEB_DIST: string;
    __dirname: string;
  }

  interface ProcessVersions {
    app: string;
  }
}

declare const ELECTRON_DEV_SERVER_URL: string;

interface Window {
  exportMediaResrouce: Function
  electronTitlebar: {
    updateTitle(title: string): void
  }
}

interface Window {
  __HOME_PAGE_HTML__: string
  SDK: import('@yxim/nim-web-sdk')
  Util: Record<any, any>
  HTTP: Record<any, any>
  Chatroom: Record<any, any>
  NIM: Record<any, any>
}

interface Document {
  /**
   * 保存所有的 script-js 导出的模块
   * */
  SCRIPT_JS_MODULES: Record<any, any>
  /**
   * 获取 script-js 导出的模块
   * */
  getScriptJsModule(moduleName: string): Record<any, any> | void

}
