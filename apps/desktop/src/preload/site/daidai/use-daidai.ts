import { sleep } from "@/utils/time";
import { ipcRenderer } from "electron";
import { reportDaiDaiEvent } from "./reportDaiDaiEvent";
import { DaiDaiChatRoomSocket } from "./socket/DaiDaiChatRoomSocket";
import { updateLog } from "./utils/updateLog";
let lastDaiDaiChatRoomSocket: DaiDaiChatRoomSocket | null = null
function joinRoom(roomId: number, channelId: string, daidaiName: string, sessionId: string) {
  const account = `wp_${getUid()}`
  const authorization = getAuthorization()
  let reconnectCont: number = 0
  const maxReconnect: number = 10
  const daiDaiChatRoomSocket = new DaiDaiChatRoomSocket()
  lastDaiDaiChatRoomSocket = daiDaiChatRoomSocket
  daiDaiChatRoomSocket.createSocketFrame()
  daiDaiChatRoomSocket.setAuthorization(authorization)
  daiDaiChatRoomSocket.setRoomId(roomId)
  daiDaiChatRoomSocket.setAccount(account)
  daiDaiChatRoomSocket.setChannelId(channelId)
  daiDaiChatRoomSocket.setSessionId(sessionId)
  updateLog(sessionId, 'info', `排队进房中...`, roomId.toString())
  daiDaiChatRoomSocket.loadSocketNIMScript().then(_ => {
    daiDaiChatRoomSocket.setInitOptions({
      ondisconnect(data) {
        updateLog(sessionId, 'error', `与房间失去连接(正在排队重连)`, roomId.toString())
        if (reconnectCont++ > maxReconnect) {
          updateLog(sessionId, 'error', `重连次数过多，已主动关闭连接!`, roomId.toString())
          return
        }
        setTimeout(() => {
          updateLog(sessionId, 'info', `重连中......`, roomId.toString())
          daiDaiChatRoomSocket.connect().then()
        })
      },
      onconnect(data) {
        console.info('已连接: ', this.account, data)
        updateLog(sessionId, 'info', `进入房间成功`, roomId.toString())
      },
      onmsgs: async (data) => {
        const msgItem = data[0]
        // console.info(msgItem)
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
            const userInfo = {
              userId: newMemberId,
              nickName: fromCustom.nick,
              sex: '男',
              favoriteGames: fromCustom.userInterests || [],
              mengxin: fromCustom.mengxin === 1,
              wealthLevelName: fromCustom.wealthLevelName || "无"
            }
            updateLog(sessionId, 'info', `符合条件---${fromCustom.nick}`, newMemberId)
            reportDaiDaiEvent(daiDaiChatRoomSocket, sessionId, newMemberId, roomId, userInfo)
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
  return token?.[1] || ''
}

function getUid() {
  const cookieString = document.cookie
  const cookieList = cookieString.split(';').map(str => str.trim().split('='))
  const uid = cookieList.find((arr) => arr[0] === 'uid')
  return uid?.[1] || ''
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

function takeOverPage() {
  const rootEl = document.querySelector<HTMLDivElement>('#root')
  if (!rootEl) return
  document.body.style.backgroundColor = 'white'
  document.body.style.backgroundImage = 'none'
  document.body.style.margin = '0'
  document.body.style.padding = '0'

  rootEl.innerHTML = '页面已被接管'
  rootEl.style.color = 'black'
  rootEl.style.backgroundColor = 'white'
  rootEl.style.margin = '0'
  rootEl.style.fontSize = '26px'
}

// 
let lastStatus = ''
async function updateAccountLoginStatus(daidaiName: string, status: string) {
  try {
    const result = await ipcRenderer.invoke('update-account-session-login-status', daidaiName, status)
    if (result.code === 0) {
      if (status !== lastStatus) {
        console.info(`账号 ${daidaiName} 状态已更新为: ${status}`)
        lastStatus = status
      }
    } else {
      console.error('更新账号状态失败:', result.message)
    }
  } catch (error) {
    console.error('更新账号状态失败:', error)
  }
}

// 检查登录状态
function checkLoginStatus(daidaiName: string) {
  if (!daidaiName) {
    console.info('未指定daidai-name, 退出')
    return false
  }
  const authorization = getAuthorization()
  const uid = getUid()
  return !!(authorization && uid)
}

function checkLoginStatusAndUpdate(daidaiName: string) {
  const isLoggedIn = checkLoginStatus(daidaiName)
  if (isLoggedIn) {
    updateAccountLoginStatus(daidaiName, '已登录')
  } else {
    updateAccountLoginStatus(daidaiName, '未登录')
  }
}

export function useDaiDai() {
  console.info('useDaiDai 加载成功')
  const daidaiName = process.argv.find(arg => arg.startsWith('daidai-name='))?.split('=')[1] || ''
  const daidaiPrelogin = process.argv.find(arg => arg.startsWith('daidai-prelogin='))?.split('=')[1] || ''

  checkLoginStatusAndUpdate(daidaiName)
  setInterval(() => checkLoginStatusAndUpdate(daidaiName), 10000)

  // 预登录， 退出
  if (daidaiPrelogin) return

  window.addEventListener('load', async () => {
    await sleep(3000)
    await injectCode()
    takeOverPage()
    const accountSession = await ipcRenderer.invoke('get-one-account-session-data', daidaiName)
    console.info(`当前运行 Session 信息:`, accountSession.data)
    const roomList = accountSession?.data?.data?.rooms || []
    // const roomList = [453936449]
    roomList.forEach(roomId => joinRoom(roomId, '1000', daidaiName, accountSession.data.name));
  })
}
