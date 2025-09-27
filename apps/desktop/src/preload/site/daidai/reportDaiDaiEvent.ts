import { ipcRenderer } from "electron"

export function reportDaiDaiEvent(sessionId: string, userId: string, roomId: number) {
  console.info(`🚀 ~ reportDaiDaiEvent`, sessionId, userId, roomId)
  return ipcRenderer.invoke('report-dai-dai-event', sessionId, userId, roomId)
}

