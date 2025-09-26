import { sleep } from "@/utils/time"
import { message } from "ant-design-vue"
import { ipcRenderer } from "electron"

const consoleLog = console.log

async function scroll(stopCheck: Function) {
  let cont = 0
  const step = 5000
  while (cont++ <= 50) {
    window.scrollTo({ top: step * cont, behavior: 'smooth' })
    await sleep(500)
    if (cont > 10) {
      const isStop = await stopCheck()
      if (isStop) break
    }
  }
  window.scrollTo({ top: 0 })
}

export async function loadDetail(pruductId: string) {
  const res = await ipcRenderer.invoke('get-one-product', pruductId)
  const titleEl = document.querySelector('[class*="mainTitle"]')
  const created_time = res?.data?.created_time || Date.now()
  const hasProduct = Date.now() - new Date(created_time).getTime() > 5000
  await scroll(() => {
    const descImages = Array.from(document.querySelectorAll('.desc-root img')).map(el => el.getAttribute('src'))
    return !descImages.includes("//g.alicdn.com/s.gif")
  })
  if (hasProduct) {
    message.info('已存在 - ' + titleEl.innerHTML)
  } else {
    const res = await ipcRenderer.invoke('get-one-product', pruductId)
    // consoleLog(`🚀 ~ loadDetail ~ res:`, res)
    if (res?.data) {
      message.success('采集成功 - ' + titleEl.innerHTML)
    }
  }
  parseImages(pruductId)
}

async function parseImages(pruductId) {
  const descImages = Array.from(document.querySelectorAll('.desc-root img')).map(el => el.getAttribute('src'))
  console.log(`🚀 ~ parseImages ~ descImages:`, descImages)
  const skuContentItemEl = document.querySelector('[class^="skuItem"] [class^="content--"]');
  const skuImages = []
  if (skuContentItemEl) {
    const allSkuEls = Array.from(skuContentItemEl.children)
    allSkuEls.forEach(el => {
      skuImages.push({
        src: el.querySelector('img')?.getAttribute('src'),
        name: el.querySelector('span')?.innerHTML
      })
    })
  }
  const res = await ipcRenderer.invoke('get-one-product', pruductId)
  // console.log(`🚀 ~ parseImages ~ res:`, res)
  if (!res) return
  await ipcRenderer.invoke('update-product', pruductId, {
    ...res.data,
    data: {
      ...res.data.data,
      descImages,
      skuImages
    }
  })
}

export function useTaobaoTmallPage() {
  window.addEventListener('load', async () => {
    consoleLog('useTaobaoTmallPage');
    if (
      location.href.startsWith('https://detail.tmall.com/item.htm') ||
      location.href.startsWith('https://item.taobao.com/item.htm')
    ) {
      const pruductId = new URL(location.href).searchParams.get('id')
      loadDetail(pruductId)
      addExportButtons(pruductId)
    }
  })
}

// 添加导出按钮的函数
function addExportButtons(pruductId: string) {
  // 创建按钮容器
  const buttonContainer = document.createElement('div')
  buttonContainer.id = 'export-buttons-container'
  buttonContainer.style.cssText = `
    position: fixed;
    top: 50px;
    left: 10px;
    z-index: 999999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `

  // 创建导出图片按钮
  const exportImageBtn = document.createElement('button')
  exportImageBtn.textContent = '导出图片'
  exportImageBtn.style.cssText = `
    padding: 6px 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    transition: all 0.3s ease;
    min-width: 80px;
  `

  // 创建导出视频按钮
  const exportVideoBtn = document.createElement('button')
  exportVideoBtn.textContent = '导出视频'
  exportVideoBtn.style.cssText = `
    padding: 6px 12px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(240, 147, 251, 0.3);
    transition: all 0.3s ease;
    min-width: 80px;
  `

  // 添加悬停效果
  const addHoverEffects = (btn: HTMLButtonElement) => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)'
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = btn === exportImageBtn
        ? '0 2px 8px rgba(102, 126, 234, 0.3)'
        : '0 2px 8px rgba(240, 147, 251, 0.3)'
    })
  }

  addHoverEffects(exportImageBtn)
  addHoverEffects(exportVideoBtn)

  // 添加点击事件
  exportImageBtn.addEventListener('click', (ev) => {
    ev.stopPropagation()
    ev.preventDefault()
    handleExportImage(pruductId)
  })
  exportVideoBtn.addEventListener('click', (ev) => {
    ev.stopPropagation()
    ev.preventDefault()
    handleExportVideo(pruductId)
  })

  // 将按钮添加到容器
  buttonContainer.appendChild(exportImageBtn)
  buttonContainer.appendChild(exportVideoBtn)

  // 将容器添加到页面
  document.body.appendChild(buttonContainer)
}

// 导出图片的回调函数
async function handleExportImage(pruductId: string) {
  const data = {
    type: 'image',
    productId: pruductId,
    currentUrl: location.href
  }
  ipcRenderer.send('export-media-resrouce-from-browser', data);
  console.log('发送导出图片请求:', data);
}

// 导出视频的回调函数
async function handleExportVideo(pruductId: string) {
  const data = {
    type: 'video',
    productId: pruductId,
    currentUrl: location.href
  }
  ipcRenderer.send('export-media-resrouce-from-browser', data);
  console.log('发送导出视频请求:', data)
}
