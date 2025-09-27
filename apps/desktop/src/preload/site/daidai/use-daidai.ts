import { sleep } from "@/utils/time";
import { ipcRenderer } from "electron";
import { DaiDaiChatRoomSocket } from "./socket/DaiDaiChatRoomSocket";

function updateStatus(id: string, status: string) {
  ipcRenderer.invoke('update-account-session', id, { status })
}

function joinRoom(roomId: number, channelId: string, daidaiName: string, id: string) {
  const account = 'wp_20396299'
  const authorization = getAuthorization()
  let reconnectCont: number = 0
  const maxReconnect: number = 10
  const daiDaiChatRoomSocket = new DaiDaiChatRoomSocket()
  daiDaiChatRoomSocket.createSocketFrame()
  daiDaiChatRoomSocket.setAuthorization(authorization)
  daiDaiChatRoomSocket.setRoomId(roomId)
  daiDaiChatRoomSocket.setAccount(account)
  daiDaiChatRoomSocket.setChannelId(channelId)
  daiDaiChatRoomSocket.loadSocketNIMScript().then(_ => {
    daiDaiChatRoomSocket.setInitOptions({
      ondisconnect(data) {
        console.info('失去连接: ', this.account, data)
        daiDaiChatRoomSocket.statusText = '与房间失去连接！'
        if (reconnectCont++ > maxReconnect) {
          daiDaiChatRoomSocket.statusText = '重连次数过多，已主动关闭连接!'
          return
        }
        setTimeout(() => {
          daiDaiChatRoomSocket.statusText = '重连中......'
          daiDaiChatRoomSocket.connect().then()
        })
      },
      onconnect(data) {
        console.info('已连接: ', this.account, data)
        daiDaiChatRoomSocket.statusText = '进入房间成功！'
      },
      onmsgs: async (data) => {
        const msgItem = data[0]
        console.info(msgItem)
        if (msgItem && msgItem.type === "notification") {
          const attach = msgItem.attach as any
          if (attach && attach.type === "updateMemberInfo") {
            // memberEnter
            const fromCustom: Record<any, any> = JSON.parse(msgItem.fromCustom)
            if (fromCustom.ifGod) return   // 大神，退出
            if (fromCustom.sex === 1) return   // 女生，退出
            if (fromCustom.client === 'backend') return   // 系统消息更新，退出
            if (fromCustom.roleId !== 0) return   // 有身份,不是普通用户 ，退出
            const newMemberId: string = attach.from.replace('wp_', '')
            if (daiDaiChatRoomSocket.account === newMemberId) return  // 如果ID是自己的，则直接忽略
            // const res = await daiDaiChatRoomSocket.getUserInfo(newMemberId)
            // if (!res.data.data) return
            // // console.info(res.data)
            // if (res.data.data['otherIfDnd'] === 1) {
            //   console.info(newMemberId, '开启了免打扰， 忽略')
            //   return   // 开启了免打扰， 忽略
            // }
            // daiDaiChatRoomSocket.lastMsgItem = msgItem
            console.info(`符合条件---${fromCustom.nick}`, newMemberId, fromCustom)
            // console.info(attach)
            // console.info('msgItem', msgItem)
            // console.info(newMemberId)
          }
        }
      }
    })
    setTimeout(() => daiDaiChatRoomSocket.connect().then(), 500)
  })
}

function getAuthorization() {
  const cookieString = document.cookie
  const cookieList = cookieString.split(';').map(str => str.trim().split('='))
  const token = cookieList.find((arr) => arr[0] === 'token')
  return token[1] || ''
}

function getUid() {
  const cookieString = document.cookie
  const cookieList = cookieString.split(';').map(str => str.trim().split('='))
  const uid = cookieList.find((arr) => arr[0] === 'uid')
  return uid[1] || ''
}

async function injectCode() {
  const scriptEl = document.createElement('script')
  scriptEl.textContent = `
    import * as MainSDK from '../static/js/index-Chvs9xgT.js'
    window.MainSDK = MainSDK  
    window.HTTP = MainSDK.H
  `
  scriptEl.type = 'module'
  document.head.appendChild(scriptEl)
}

export function useDaiDai() {
  console.info('useDaiDai 加载成功')
  const daidaiName = process.argv.find(arg => arg.startsWith('daidai-name='))?.split('=')[1]
  if (!getAuthorization() || !getUid()) {
    console.info('未登录， 退出')
    return
  }
  if (!daidaiName) {
    console.info('未指定daidai-name， 退出')
    return
  }

  window.addEventListener('DOMContentLoaded', async () => {
  })

  window.addEventListener('load', async () => {
    await sleep(3000)
    await injectCode()
    const accountSession = await ipcRenderer.invoke('get-one-account-session-data', daidaiName)
    console.info(`🚀 ~ useDaiDai ~ accountSession:`, accountSession)
    const roomList = accountSession?.data?.data?.rooms || []
    console.info(`🚀 ~ useDaiDai ~ roomList:`, roomList)
    roomList.forEach(roomId => joinRoom(roomId, '1000', daidaiName, accountSession.data.id));
  })
}
