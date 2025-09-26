import message from "ant-design-vue/es/message"
import { ipcRenderer } from "electron"

const consoleLog = console.log

export async function loadDetail(pruductId: string) {
  window.addEventListener('load', async () => {
    const res = await ipcRenderer.invoke('get-one-product', pruductId)
    if (!res) return
    consoleLog(res)
    const created_time = res.data?.created_time
    const title = res.data?.title
    console.log(`🚀 ~ loadDetail ~ create_time:`, created_time)
    if (!created_time || !title) return
    const offsetTime = Math.ceil((Date.now() - new Date(created_time).getTime()) / 1000)
    consoleLog(offsetTime)
    if (offsetTime >= 5) {
      message.info({
        content: () => '已存在 - ' + title,
      })
    } else {
      message.success({
        content: () => '采集成功 - ' + title,
        style: {
          color: 'green !important'
        }
      })
    }
    parseImages(pruductId)
  })
}

async function parseImages(pruductId) {
  const allImageEls = [...document.querySelector('.html-description')?.shadowRoot.querySelectorAll('#detail img')]
  const allDescImageLink = allImageEls.map(el => el.getAttribute('src'))
  const res = await ipcRenderer.invoke('get-one-product', pruductId)
  if (!res) return
  await ipcRenderer.invoke('update-product', pruductId, {
    ...res.data,
    data: {
      ...res.data.data,
      descImages: allDescImageLink,
    }
  })
}

function fixAntMessagePosition() {
  const styleEl = document.createElement('style')
  const popupLeft = window.screen.width / 2 - 250
  styleEl.innerHTML = `
    .ant-message {
      left: ${popupLeft}px !important;
    }
    .ant-message-notice-content{
      background: rgba(255, 255, 255, 0.8) !important;
    }
    .ant-message-custom-content {
      color: #000;
      font-weight: 600
    }
  `
  window.addEventListener('load', () => {
    document.head.appendChild(styleEl)
  })
}

export function use1688Page() {
  consoleLog('use1688Page');
  fixAntMessagePosition()

  if (location.href.startsWith('https://detail.1688.com/offer/') && location.pathname.endsWith('.html')) {
    const productId = location.pathname.replace('.html', '').replace('/offer/', '')
    consoleLog(`🚀 ~ use1688Page ~ productId:`, productId)
    loadDetail(productId)
  }
}
