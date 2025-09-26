import { message } from "ant-design-vue"
import { ipcRenderer } from "electron"

async function parsePddGoodDetail() {
  const product: Record<any, any> = {}
  const searchParams = new URL(location.href).searchParams
  const goodsInfo = window['rawData']?.store.initDataObj.goods
  const searchKeyword = searchParams.get('_x_query') || ''
  const goods_id = searchParams.get('goods_id') || ''
  if (!goodsInfo || !goods_id) return

  const mainImages = [...goodsInfo.topGallery].map(obj => obj.url)
  const descImages = [...goodsInfo.detailGallery].map(obj => obj.url)
  const map = {}
  goodsInfo.skus.forEach(sku => {
    const skuName = sku.specs[0].spec_value
    if (!map[skuName]) {
      map[skuName] = {
        src: sku.thumbUrl,
        name: skuName
      }
    }
  })
  const skuImages = Object.values(map)

  const videos = [...goodsInfo.videoGallery]

  product.id = `pdd-${goods_id}`
  product.title = goodsInfo.goodsName
  product.keyword = searchKeyword
  product.detailUrl = `https://mobile.yangkeduo.com/goods.html?goods_id=${goods_id}`
  product.data = {
    skus: goodsInfo.skus || [],
    mainImages,
    descImages,
    skuImages,
    videos
  }
  product.deliveryDay = '1'
  product.type = 'pdd'
  console.log(`🚀 ~ parsePddGoodDetail ~ product:`, product)

  const isSuccess = await ipcRenderer.invoke('save-product-data', product)
  if (isSuccess) {
    message.success('采集成功 - ' + product.title)
  } else {
    message.info('已存在 - ' + product.title)
  }
}

export function usePddPage() {
  window.addEventListener('load', () => {
    console.log('usePddPage');
    console.warn = console.log

    if (location.pathname.startsWith('/goods.html')) {
      parsePddGoodDetail()
    }
  })
}
