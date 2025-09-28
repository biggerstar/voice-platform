import type { NIMChatroomGetInstanceOptions } from '@yxim/nim-web-sdk/dist/types/chatroom/types';
import { updateLog } from '../utils/updateLog';
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
    updateLog(this.sessionId, 'info', '开始获取房间 token', this.chatroomId)
    const token = await this.fetchRoomTokenString()
    if (!token) {
      throw new Error('未获取到房间连接的 token ')
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
      reconnectionAttempts: 30,
      privateConf: {
        isDataReportEnable: false,
        loginSDKTypeParamCompat: true
      }
    }
    Object.assign(this.initOptions, options)
    if (this.window?.Chatroom) {
      // @ts-ignore
      this.instance = this.window['Chatroom'].getInstance(this.initOptions)
    }
  }

  private async fetchRoomTokenString() {
    const res = await window.HTTP._get_room_pre_detail({ roomId: this.chatroomId })
    if (res?.data?.randomToken) {
      updateLog(this.sessionId, 'info', '获取房间 token 成功', this.chatroomId)
    } else {
      updateLog(this.sessionId, 'error', `获取房间 token 失败，${res?.message}`)
    }
    return res?.data?.randomToken
  }

  public async fetchUserInfo(targetUid: string) {
    if (!this.Authorization) {
      throw new Error('未指定 Authorization')
    }
    if (!this.userId) {
      throw new Error('未指定 userId')
    }
    const config = {
      "uid": targetUid,
      "myUid": this.userId,
      "qKey": "DsMain"
    }
    const res = await window.HTTP._get_v4_new_god_detailed(config)
    if (res?.data?.userInfo) {
      updateLog(this.sessionId, 'info', '获取用户信息成功', res?.data?.userInfo)
    } else {
      updateLog(this.sessionId, 'error', `获取用户信息失败，${res?.message}`)
    }
    return res?.data
  }

  /**
   * 获取房间魅力榜
   */
  public async fetchRoomMeiliTopInfo(targetRoomId: string) {
    if (!this.Authorization) {
      throw new Error('未指定 Authorization')
    }
    if (!this.userId) {
      throw new Error('未指定 userId')
    }
    const config = {
      "type": 2,
      "dtype": 1,
      "roomid": targetRoomId
    }
    const res = await window.HTTP._room_tops(config)
    return res?.data
  }

  /**
   * 获取房间财富榜
   */
  public async fetchRoomWealthTopInfo(targetRoomId: string) {
    if (!this.Authorization) {
      throw new Error('未指定 Authorization')
    }
    if (!this.userId) {
      throw new Error('未指定 userId')
    }
    const config = {
      "type": 1,
      "dtype": 1,
      "roomid": targetRoomId
    }
    const res = await window.HTTP._room_tops(config)
    return res?.data
  }

  /**
   * 拦截 this.window['SDK']['NIM'] 的执行并输出相关函数的入参信息
   */
  public override interceptFunctionExecAndOutput() {
    return this._interceptFunctionExecAndOutput('Chatroom')
  }
}


