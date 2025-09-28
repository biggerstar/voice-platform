import { CustomTitlebar } from 'custom-electron-titlebar';

// 日志相关类型定义
interface DaidaiLog {
  id: string;
  accountSessionId: string;
  roomId: string;
  status: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DaidaiLogQueryOptions {
  accountSessionId?: string;
  skip?: number;
  take?: number;
  where?: Record<string, any>;
  pageSize?: number;
  currentPage?: number;
}

interface DaidaiLogResponse {
  success: boolean;
  data?: {
    items: DaidaiLog[];
    total: number;
    pageSize: number;
    current: number;
  };
  error?: string;
}

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
    // 日志相关接口
    getDaidaiLogs(options?: DaidaiLogQueryOptions): Promise<DaidaiLogResponse>
    updateDaidaiLog(id: string, status: string, message?: string, roomId?: string): Promise<{ success: boolean; data?: DaidaiLog; error?: string }>
    deleteDaidaiLogs(ids?: string[]): Promise<{ success: boolean; error?: string }>
    clearAllDaidaiLogs(): Promise<{ success: boolean; error?: string }>
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
    // 重连房间接口
    reconnectRoom(options: {
      roomId: string
      accountSessionId: string
      chatroomName?: string
    }): Promise<{
      success: boolean
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
