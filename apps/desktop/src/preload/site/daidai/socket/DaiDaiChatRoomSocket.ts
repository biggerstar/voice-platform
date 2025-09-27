import type { NIMChatroomGetInstanceOptions } from '@yxim/nim-web-sdk/dist/types/chatroom/types';
import { BaseNimSocket } from "./BaseSocket";

export class DaiDaiChatRoomSocket extends BaseNimSocket<import('@yxim/nim-web-sdk').Chatroom> {
  private APP_KEY: string = 'b55d55a4ab9cd26044ad6a4ee2380c53'
  public lastMsgItem?: Record<any, any>
  public statusText: string = ''
  public lastId?: string
  public initOptions: Partial<NIMChatroomGetInstanceOptions> & Record<any, any> = {}

  public setInitOptions(opt: Partial<NIMChatroomGetInstanceOptions>) {
    Object.assign(this.initOptions, opt)
  }

  /**
   * 必要  chatroomId  只必要 chatroomId 就行# Download and install Chocolatey:powershell -c "irm https://community.chocolatey.org/install.ps1|iex"# Download and install Node.js:choco install nodejs --version="22.19.0"# Verify the Node.js version:node -v # Should print "v22.19.0".# Verify npm version:npm -v # Should print "10.9.3".
   * 监听回调
   * see https://doc.yunxin.163.com/messaging/api-refer/web/typedoc/Latest/zh/NIM/index.html
   */
  protected override async _connect(): Promise<any> {
    if (!this.Authorization) {
      throw new Error('未指定 Authorization')
    }
    if (!this.chatroomId) {
      throw new Error('没有设置 roomid')
    }
    const token = await this.fetchTokenString()
    console.info(`🚀 ~ DaiDaiChatRoomSocket ~ _connect ~ token:`, token)
    if (!token) {
      new Error('未获取到房间连接的 token ')
    }
    const options = <Partial<NIMChatroomGetInstanceOptions>>{
      // debug: true,
      appKey: this.APP_KEY,
      secure: true,
      isAnonymous: false,
      token: token,
      loginAuthType: 2,
      chatroomId: this.chatroomId,
      chatroomAddresses: [
        "chatwl01.yunxinfw.com:443",
        "chatwl02.yunxinfw.com:443"
      ],
      account: this.account,
      needReconnect: true,
      quickReconnect: true,
      reconnectionAttempts: 20,
    }
    Object.assign(this.initOptions, options)
    if (this.window?.Chatroom) {
      // @ts-ignore
      this.instance = new this.window['Chatroom'](this.initOptions)
    }
  }

  private async fetchTokenString() {
    return window.HTTP._get_room_pre_detail({ roomId: this.chatroomId }).then(res => res?.data?.randomToken)
  }

  /**
   * 拦截 this.window['SDK']['NIM'] 的执行并输出相关函数的入参信息
   */
  public override interceptFunctionExecAndOutput() {
    return this._interceptFunctionExecAndOutput('Chatroom')
  }
}


