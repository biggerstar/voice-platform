import { globalRendererPathParser } from "@/global/global-renderer-path-parser";
import { sleep } from "@/utils/time";
import fs from "fs";
import PQueue from "p-queue";

const queue = new PQueue({ concurrency: 1 })

export class BaseNimSocket<Instance> {
  public instance?: Instance & Record<any, any>
  public window!: Window | null
  public iframe?: HTMLIFrameElement
  public SDK?: Record<any, any>
  public chatroomId?: string
  public channelId?: string
  public account?: string
  public userId?: string
  public Authorization?: string
  protected _isDestroyed?: boolean
  public sessionId?: string

  constructor() {
    this.resetStatus()
  }

  public setSessionId(id: string) {
    this.sessionId = id
  }

  public setAuthorization(Authorization: string) {
    this.Authorization = Authorization
  }

  public setAccount(account: string) {
    this.account = account
    this.userId = account.split('_')[1]
  }

  public setRoomId(chatroomId: string | number) {
    this.chatroomId = chatroomId.toString()
  }

  public setChannelId(channelId: string) {
    this.channelId = channelId.toString()
  }

  protected _connect(): Promise<any> {
    return Promise.resolve()
  }

  public async connect(): Promise<any> {
    if (this._isDestroyed) return
    return queue.add(async () => {
      await sleep(6000)
      return this._connect()
    })
  }

  public resetStatus() {
    this._isDestroyed = false
  }

  public createSocketFrame() {
    const iframe = document.createElement('iframe')
    iframe.height = '0'
    iframe.width = '0'
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
    this.window = iframe.contentWindow
    this.iframe = iframe
    return this.window
  }

  public async loadSocketNIMScript() {
    if (!this.window) throw new Error('请先创建 iframe');
    const Chatroom_SDK_PATH = globalRendererPathParser.resolveAppRoot('NIM_Web_Chatroom.js').toString()
    const scriptEl = this.window.document.createElement('script')
    scriptEl.textContent = await fs.promises.readFile(Chatroom_SDK_PATH, 'utf-8');
    this.window.document.head.appendChild(scriptEl)
  }

  public destroy(): void {
    this.instance && this.instance.destroy()
    this.iframe && this.iframe?.parentElement?.removeChild(this.iframe)
    this._isDestroyed = true
  }

  public get connected() {
    return new Promise(resolve => {
      const timer = setInterval(() => {
        if (this.instance) {
          this.instance && resolve('')
          clearInterval(timer)
        }
      })
    })
  }

  /**
   * 拦截 this.window['SDK']['NIM | Chatroom'] 的执行并输出相关函数的入参信息
   */
  protected _interceptFunctionExecAndOutput(type: 'NIM' | 'Chatroom') {
    if (!this.SDK) throw new Error('未找到 this.SDK')
    const Chatroom = this.SDK[type]
    const allFunctionNameList = Object.keys(Chatroom.fn)
    allFunctionNameList.forEach(name => {
      const oldFunction = Chatroom.fn[name]
      if (typeof oldFunction !== 'function') return
      Chatroom.fn[name] = function (...args: any[]) {
        console.info(name, args)
        return oldFunction.call(this, ...args)
      }
    })
  }
  /**
   * 拦截 this.window['SDK']['NIM'] 的执行并输出相关函数的入参信息
   */
  public interceptFunctionExecAndOutput() {
    return this._interceptFunctionExecAndOutput('NIM')
  }
}


