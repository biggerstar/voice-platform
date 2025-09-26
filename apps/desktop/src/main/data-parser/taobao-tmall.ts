import { parseJsonpSafeByBase64 } from "@/utils/jsonp";
import type { BrowserWindow } from "electron";
import { getOneProduct, updatePruduct } from "../ipc";
import { browserinternetView, WindowEventType } from "../windows/browser";
import { parseTaobao } from "../windows/main/pipe-taobao";

let lastTaobaoSetachKeyWord = '';

browserinternetView.addEventListener(WindowEventType.WINDOW_CREATED, (eventType, data) => {
  if (!data.window) return;
  const browserWebRequest = data.window.webContents.session.webRequest
  // const requestMap = new Map<string, OnBeforeRequestListenerDetails>()
  browserWebRequest.onBeforeSendHeaders({
    urls: ['*://*.taobao.com/*', '*://*.tmall.com/*']
  }, async (detail, callback) => {
    // const requestInfo = requestMap.get(getMapKey(detail))
    // requestMap.delete(getMapKey(detail))
    const cookies = await data.window.webContents.session.cookies.get({ url: detail.url })
    const cookie = cookies.map(item => `${item.name}=${item.value}`).join(',')
    const requestHeaders = { ...detail.requestHeaders }
    requestHeaders['Cookie'] = detail.requestHeaders['Cookie'] || detail.requestHeaders['cookie'] || cookie
    if (detail.url.includes('api=mtop.taobao.pcdetail.data.get')) {
      parseTaobaoPcdetailApi(detail.url, { headers: requestHeaders }, data.window as BrowserWindow)
    }
    if (detail.url.startsWith('https://s.taobao.com/search')) {
      const urls = new URL(detail.url)
      if (urls.searchParams.get('q')) lastTaobaoSetachKeyWord = urls.searchParams.get('q')
    }
    // if (detail.url.includes('api=mtop.taobao.detail.getdesc')) {
    //   parseTaobaoDescImages(detail.url, { headers: requestHeaders }, data.window as BrowserWindow)
    // }
    if (detail.url.includes('api=mtop.taobao.cloudvideo.video.query')) {
      parseTaobaoVideo(detail.url, { headers: requestHeaders }, data.window as BrowserWindow)
    }
    callback({})
  })
})

async function parseTaobaoVideo(url, init, window: BrowserWindow) {
  try {
    const currentUrl = await window.webContents.getURL()
    const productId = new URL(currentUrl).searchParams.get('id')
    const resData = await fetch(url, init).then(res => res.text())
    let jsonBody = parseJsonpSafeByBase64(Buffer.from(resData).toString('base64'));
    if (jsonBody) {
      const videoItems = jsonBody.data.resources
      const product = (await getOneProduct(productId)).data
      if (!product) return
      await updatePruduct(productId, {
        ...product,
        data: {
          ...product.data,
          videos: videoItems
        }
      })
    }
  } catch (e) {
    console.log(e.message)
  }
}

async function parseTaobaoDescImages(url, init, window: BrowserWindow) {
  try {
    const productId = JSON.parse(new URL(url).searchParams.get('data')).id
    const resData = await fetch(url, init).then(res => res.text())
    let jsonBody = parseJsonpSafeByBase64(Buffer.from(resData).toString('base64'));
    if (jsonBody) {
      const picItems = Object.values(jsonBody.data.components.componentData)
      const descImages = picItems.map((item: any) => {
        if (item.model.text) {
          const regex = /<img[^>]*src="([^"]*)"[^>]*>/g;
          let matches;
          const urls = [];
          while ((matches = regex.exec(item.model.text)) !== null) {
            let picUrl = matches[1]
            picUrl = String(picUrl).replace('https://', 'http://')
            urls.push(picUrl);
          }
          return urls
        }
        let picUrl: string = item.model.picUrl
        String(picUrl).replace('https://', 'http://')
        return String(picUrl).startsWith('//') ? `https:${picUrl}` : picUrl
      })
        .filter(Boolean)
        .flat(3)
        .filter((url: string) => {
          if (url.includes('spaceball.gif')) return false
          return true
        })
      const product = (await getOneProduct(productId)).data
      if (!product) return
      await updatePruduct(productId, {
        ...product,
        data: {
          ...product.data,
          descImages
        }
      })
    }
    console.log(`🚀 ~ parseTaobaoDescImages ~ product:`, (await getOneProduct(productId)).data)
  } catch (e) {
    console.log(e.message)
  }
}

async function parseTaobaoPcdetailApi(url, init, window: BrowserWindow) {
  try {
    const resData = await fetch(url, init).then(res => res.text())
    let jsonBody = parseJsonpSafeByBase64(Buffer.from(resData).toString('base64'));
    if (jsonBody) {
      if (url.includes('mtop.taobao.pcdetail.data.get')) {
        parseTaobao(lastTaobaoSetachKeyWord, jsonBody)
      }
    }
  } catch (e) {

  }
}
