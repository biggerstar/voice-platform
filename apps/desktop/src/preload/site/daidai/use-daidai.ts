import { sleep } from "@/utils/time";
import { ipcRenderer } from "electron";
import { reportDaiDaiEvent } from "./reportDaiDaiEvent";
import { DaiDaiChatRoomSocket } from "./socket/DaiDaiChatRoomSocket";
import { updateLog } from "./utils/updateLog";

// 创建 Map 存储每个房间的 socket 实例，key 为 roomId_sessionId
const socketMap = new Map<string, DaiDaiChatRoomSocket>();

function joinRoom(roomId: number, channelId: string, sessionId: string) {
  console.info(`🚀 [joinRoom] 开始加入房间，roomId: ${roomId}, channelId: ${channelId}, sessionId: ${sessionId}`);

  const account = `wp_${getUid()}`
  const authorization = getAuthorization()
  let reconnectCont: number = 0
  const maxReconnect: number = 20

  // 生成唯一的 socket key
  const socketKey = `${roomId}_${sessionId}`;

  // 检查是否已存在 socket 实例
  let daiDaiChatRoomSocket = socketMap.get(socketKey);

  if (daiDaiChatRoomSocket) {
    // 复用现有的 socket
    console.info(`🔄 复用现有 socket 实例: ${socketKey}`);
    updateLog(sessionId, 'info', `复用现有连接，重新进房中...`, roomId.toString());

    // 重新连接
    setTimeout(() => {
      daiDaiChatRoomSocket!.connect().then(() => {
        console.info(`✅ 复用 socket 重连成功: ${socketKey}`);
      }).catch((error) => {
        console.error(`❌ 复用 socket 重连失败: ${socketKey}`, error);
        updateLog(sessionId, 'error', `复用连接失败: ${error.message}`, roomId.toString());
      });
    }, 500);
    return;
  }

  // 创建新的 socket 实例
  daiDaiChatRoomSocket = new DaiDaiChatRoomSocket();

  // 存储到 Map 中
  socketMap.set(socketKey, daiDaiChatRoomSocket);

  daiDaiChatRoomSocket.createSocketFrame()
  daiDaiChatRoomSocket.setAuthorization(authorization)
  daiDaiChatRoomSocket.setRoomId(roomId)
  daiDaiChatRoomSocket.setAccount(account)
  daiDaiChatRoomSocket.setChannelId(channelId)
  daiDaiChatRoomSocket.setSessionId(sessionId)
  updateLog(sessionId, 'info', `排队进房中...`, roomId.toString())
  daiDaiChatRoomSocket.loadSocketNIMScript().then(_ => {
    daiDaiChatRoomSocket!.setInitOptions({
      ondisconnect(data) {
        if (data.code === 20013) {
          updateLog(sessionId, 'info', `同账号派单厅只允许加入一个!!!`, roomId.toString())
          return
        }
        updateLog(sessionId, 'error', `与房间失去连接(原因: ${data['reason'] || data.message})(正在排队重连)`, roomId.toString())
        if (reconnectCont++ > maxReconnect) {
          updateLog(sessionId, 'error', `重连次数过多，已主动关闭连接!`, roomId.toString())
          // 从 Map 中移除失败的 socket
          socketMap.delete(socketKey);
          return
        }
        setTimeout(() => {
          daiDaiChatRoomSocket!.connect().then()
        }, 20 * 1000)
      },
      onconnect(data: any) {
        console.info('已连接: ', this.account, data)
        const chatroomName = data.chatroom?.name
        updateLog(sessionId, 'info', `进入房间成功`, roomId.toString(), chatroomName)
        // 重置重连计数器
        reconnectCont = 0;
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
            if (daiDaiChatRoomSocket!.account === newMemberId) return  // 如果ID是自己的，则直接忽略
            const userInfo = {
              userId: newMemberId,
              nickName: fromCustom.nick,
              sex: '男',
              favoriteGames: fromCustom.userInterests || [],
              mengxin: fromCustom.mengxin === 1,
              wealthLevelName: fromCustom.wealthLevelName || "无"
            }
            updateLog(sessionId, 'info', `符合条件---${fromCustom.nick}(${newMemberId})`, roomId.toString())
            reportDaiDaiEvent(daiDaiChatRoomSocket!, sessionId, newMemberId, roomId, userInfo)
          }
        }
      }
    })
    setTimeout(() => daiDaiChatRoomSocket!.connect().then(), 500)
    // daiDaiChatRoomSocket.fetchRoomMeiliTopInfo(roomId.toString()).then((res) => {
    //   console.info(`🚀 ~ useDaiDai ~ res:`, res)
    // })
    // daiDaiChatRoomSocket.fetchRoomWealthTopInfo(roomId.toString()).then((res) => {
    //   console.info(`🚀 ~ useDaiDai ~ res:`, res)
    // })
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

const setIntervalRef = setInterval

export function useDaiDai() {
  console.info('[useDaiDai] 加载成功')
  const daidaiName = process.argv.find(arg => arg.startsWith('daidai-name='))?.split('=')[1] || ''
  console.info(`🎯 [useDaiDai] 开始初始化，会话名称: ${daidaiName}`);
  const daidaiPrelogin = process.argv.find(arg => arg.startsWith('daidai-prelogin='))?.split('=')[1] || ''

  checkLoginStatusAndUpdate(daidaiName)
  setIntervalRef(() => checkLoginStatusAndUpdate(daidaiName), 3000)

  // 监听重连房间事件
  ipcRenderer.on('reconnect-room-request', (event, data: {
    roomId: string;
    accountSessionId: string;
    chatroomName?: string;
  }) => {
    console.info('🔄 [reconnect-room-request] 收到重连请求:', data);
    const { roomId, accountSessionId } = data;
    joinRoom(parseInt(roomId), '1000', accountSessionId);
  });

  // 监听获取榜单数据请求
  console.info('📋 [useDaiDai] 注册fetch-leaderboard-data-request监听器');
  ipcRenderer.on('fetch-leaderboard-data-request', async (event, data: {
    requestId: string;
    roomId: string;
    sessionId: string;
  }) => {
    console.info('📊 [fetch-leaderboard-data-request] 收到榜单数据请求:', data);
    const { requestId, roomId, sessionId } = data;

    try {
      // 获取对应房间的socket实例
      const socketKey = `${roomId}_${sessionId}`;
      const socket = socketMap.get(socketKey);

      if (!socket) {
        const error = `未找到房间 ${roomId} 的socket连接，期望key: ${socketKey}`;
        console.error(`❌ [fetch-leaderboard-data-request] ${error}`);
        console.error(`❌ [fetch-leaderboard-data-request] 可用的socket keys:`, Array.from(socketMap.keys()));
        ipcRenderer.send('leaderboard-data-response', {
          requestId,
          success: false,
          error
        });
        return;
      }

      console.info(`✅ [fetch-leaderboard-data-request] 找到socket连接，开始获取榜单数据`);

      // 并行获取魅力榜和财富榜数据
      const [meiliTopInfo, wealthTopInfo] = await Promise.all([
        // socket.fetchRoomMeiliTopInfo(roomId),
        [],
        socket.fetchRoomWealthTopInfo(roomId)
      ]);

      // 发送响应给主进程
      ipcRenderer.send('leaderboard-data-response', {
        requestId,
        success: true,
        data: {
          meiliTopInfo: meiliTopInfo || [],
          wealthTopInfo: wealthTopInfo || []
        }
      });
    } catch (error) {
      console.info(`❌ [fetch-leaderboard-data-request] 获取榜单数据失败:`, error);
      ipcRenderer.send('leaderboard-data-response', {
        requestId,
        success: false,
        error: error instanceof Error ? error.message : '获取榜单数据失败'
      });
    }
  });

  // 预登录， 退出
  if (daidaiPrelogin) return;

  console.info(`🎯 [useDaiDai] 注册window load事件监听器`);
  window.addEventListener('load', async () => {
    await sleep(3000)
    await injectCode()
    await takeOverPage()
    const accountSession = await ipcRenderer.invoke('get-one-account-session-data', daidaiName)
    const roomList = accountSession?.data?.data?.rooms || []
    // const roomList = [185173982]  // 派单厅
    // const roomList = [3910452462]
    roomList.forEach(roomId => joinRoom(roomId, '1000', daidaiName));
  })
}
