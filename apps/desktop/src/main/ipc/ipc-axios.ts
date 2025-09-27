import axios, { type AxiosRequestConfig } from "axios";
import { ipcMain } from "electron";

ipcMain.handle('axios-request', async (_: any, config: AxiosRequestConfig) => {
  return await axios
    .request(config)
    .then(res => res.data)
    .catch(err => Promise.reject(err))
})
