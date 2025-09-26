import { net } from 'electron';
import * as iconv from 'iconv-lite';
import { browserinternetView, WindowEventType } from "../windows/browser";
import { parse1688 } from '../windows/main/pipe-1688';

let last1688SetachKeyWord = '';

browserinternetView.addEventListener(WindowEventType.WINDOW_CREATED, () => {
  const browserWebRequest = browserinternetView.win.webContents.session.webRequest
  browserWebRequest.onSendHeaders((detail) => {
    if (detail.url.startsWith('https://detail.1688.com/offer')) {
      parse1688PcdetailApi(detail.url, { headers: detail.requestHeaders })
    }
    if (detail.url.startsWith('https://s.1688.com/selloffer/offer_search.htm')) {
      const query = detail.url?.split('?')[1] || ''
      const queryMap = {}
      query.split('&').map((str) => queryMap[str.split('=')[0]] = str.split('=')[1])
      if (queryMap['charset'] === 'utf8') {
        last1688SetachKeyWord = decodeURIComponent(queryMap['keywords'])
      } else if (queryMap['keywords']) {
        const keywords = queryMap['keywords']
        const buffer = Buffer.from(keywords.replace(/%/g, ''), 'hex');
        last1688SetachKeyWord = iconv.decode(buffer, 'gbk');
      }
    }
  })
})

async function parse1688PcdetailApi(url, init) {
  // console.log(`🚀 ~ parse1688PcdetailApi ~ url:`, last1688SetachKeyWord, url, init)
  const resData = await net.fetch(url, init).then(res => res.text())
  // console.log(`🚀 ~ parse1688PcdetailApi ~ resData:`, resData)
  try {
    parse1688(last1688SetachKeyWord, resData)
  } catch (e) { }
}
