import { ipcRenderer } from "electron";

export function updateLog(sessionId: string, status: string, message?: string, roomId?: string) {
  return ipcRenderer.invoke('update-daidai-log', sessionId, status, message, roomId);
}
