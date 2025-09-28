import { ipcRenderer } from "electron"
import type { DaiDaiChatRoomSocket } from "./socket/DaiDaiChatRoomSocket"

const userInfoCache = new Map<string, any>()

export async function reportDaiDaiEvent(daiDaiChatRoomSocket: DaiDaiChatRoomSocket, sessionId: string, userId: string, roomId: number, userInfoData: any) {
  // let userInfo = userInfoCache.get(userId)
  // if (!userInfo) {
  //   userInfo = await daiDaiChatRoomSocket.fetchUserInfo(userId)
  //   if (!userInfo) return
  //   if (userInfo) userInfoCache.set(userId, userInfo)
  // }

  const reportData = {
    sessionId,
    userId,
    roomId,
    data: {
      ...userInfoData,
      // fans: userInfo?.fansNum || 0,
    }
  }
  console.info('📝 解析后的报告数据:', reportData)
  return ipcRenderer.invoke('report-dai-dai-event', reportData)
}

