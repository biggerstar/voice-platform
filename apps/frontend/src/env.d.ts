import { CustomTitlebar } from 'custom-electron-titlebar'


declare global {
  declare interface Window {
    electronTitlebar: CustomTitlebar
    exportMediaResrouce: Function
    __VBEN_ADMIN_METADATA__: Record<any, any>
    _SERVER_API_: string
    SDK: import('@yxim/nim-web-sdk')
    Util: Record<any, any>
  }

  declare const __API__: {
    axiosRequest(config: any): Promise<any>
    login(form: any): Promise<any>
    showWindow(): Promise<void>
    hideWindow(): Promise<void>
    isShow(): Promise<boolean>
    close(): Promise<boolean>
    loadURL(url: string): Promise<void>
    reopenBrowser(options: Record<any, any>): Promise<void>
    getURL(): Promise<void | string>
    getPruductList(options: Record<any, any>): Promise<any>
    getOneList(id: string): Promise<any>
    deleteProduct(ids: string[]): Promise<void>
    updateProduct(id: string, data: Record<any, any>): Promise<any>
    getAccountSessionList(options: Record<any, any>): Promise<any>
    createAccountSession(data: Record<any, any>): Promise<any>
    updateAccountSession(id: string, data: Record<any, any>): Promise<any>
    deleteAccountSession(ids: string[]): Promise<void>
    // 镜像任务相关接口
    startMirrorTask(options: { name: string; type: string }[] | { name: string; type: string }): Promise<{
      success: boolean
      message?: string
      error?: string
      results?: Array<{ success: boolean; message?: string; error?: string; viewId?: string }>
      errors?: string[]
      activeCount?: number
    }>
    stopMirrorTask(viewIds?: string[]): Promise<{
      success: boolean
      message?: string
      error?: string
      results?: Array<{ viewId: string; success: boolean; message?: string; error?: string }>
      errors?: string[]
      activeCount?: number
    }>
    getMirrorTaskStatus(): Promise<{
      success: boolean
      isRunning?: boolean
      activeCount?: number
      activeViewIds?: string[]
      message?: string
      error?: string
    }>
  }

  declare const __TABLE_API__: {
    getAnchorList(options: any): any
    getBossList(options: any): any
    deleteAnchorList(ids: string[]): any
    deleteBossList(ids: string[]): any
  }
}
