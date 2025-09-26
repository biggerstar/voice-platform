<script lang="ts" setup>

import type {
  VxeTableGridOptions
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

import type { CompanyUserApi } from '#/api/company/user';
import AccountSessoinViewer from '#/components/AccountSessoinViewer.vue';
import ImageViewer from '#/components/ImageViewer.vue';
import VideoViewer from '#/components/VideoViewer.vue';
import { onMounted, onUnmounted, ref } from 'vue';
import { useColumns, useGridFormSchema } from './data';

const showImageViewer = ref(false);
const currentExportImagesOptions = ref({})
const imageViewerRef = ref()

// 视频导出相关
const showVideoViewer = ref(false);
const currentExportVideosOptions = ref({})
const videoViewerRef = ref()

const [downloadImagesModal, downloadImagesModalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '导出选中图片',
  async onConfirm() {
    if (imageViewerRef.value) {
      const result = await imageViewerRef.value.exportZip()
      if (result) {
        gridApi.query()
        downloadImagesModalApi.close()
      }
    }
  },
  onClosed: () => {
    showImageViewer.value = false;
  },
});

const [downloadVideosModal, downloadVideosModalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '下载选中视频',
  async onConfirm() {
    if (videoViewerRef.value) {
      const result = await videoViewerRef.value.downloadSelectedVideos()
      if (result) {
        gridApi.query()
        downloadVideosModalApi.close()
      }
    }
  },
  onClosed: () => {
    showVideoViewer.value = false;
  },
});

const [accountSessionModel, modalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '关闭窗口',
  async onConfirm() {
    modalApi.close()
  },
});

const [Grid, gridApi] = useVbenVxeGrid({
  showSearchForm: false,
  formOptions: {
    schema: useGridFormSchema(),
    compact: true,
    submitOnChange: true,
    showCollapseButton: false,
    // wrapperClass: "grid-cols-5",
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    showOverflow: true,
    virtualYConfig: {
      enabled: true,
      gt: 0
    },
    pagerConfig: {
      pageSize: 2000,
      pageSizes: [50, 200, 500, 2000, 5000]
    },
    checkboxConfig: {
      range: true
    },
    exportConfig: {
      types: ['csv', 'txt'],
      includeFields: [
        'index',
        'keyword',
        'detailUrl',
        'title',
        'color',
        'size',
        'presale',
        'remark',
      ],
      columnFilterMethod({ column }) {
        if (column.type === 'checkbox') return false
        return true
      }
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await __API__.getPruductList({
            where: { type: 'pdd' },
            pageSize: page.pageSize,
            currentPage: page.currentPage,
            ...formValues
          })
          console.log(`🚀 ~ result.data:`, result.data)
          return result.data
        },
      },
    },
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: { code: 'query' },
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions<CompanyUserApi.User>,
});

function parseColor(row: any) {
  const colorList = row.data.skus.map((sku: any) => sku?.specs?.[0]?.spec_value)
  row.color = [...new Set(colorList)].join('\n')
  return row.color
}

function parseSize(row: any) {
  const sizeList = row.data.skus.map((sku: any) => sku?.specs?.[1]?.spec_value)
  row.size = [...new Set(sizeList)].join('\n')
  return row.size
}

function parseRemark(row: any): string {
  const causeList: string[] = []
  const notQuantityList: string[] = []
  row.data.skus.map((sku: any) => {
    if (sku.sideCarLabels) {
      const sideCarLabelList = sku.sideCarLabels.filter((side: any) => side.text).map((side: any) => side.text)
      const cause = `${sku?.specs?.[0]?.spec_value}-${sku?.specs?.[1]?.spec_value} - ${sideCarLabelList.join(' ')}`
      causeList.push(cause)
    }
    if (sku.quantity === 0) {
      const cause = `${sku?.specs?.[0]?.spec_value}-${sku?.specs?.[1]?.spec_value} - 无货`
      notQuantityList.push(cause)
    }
  })
  return [...notQuantityList, ...causeList].join('\n')
}

function parsePresale(row: any) {
  return row.title.includes('预售') ? '是' : ''
}

function exportImages() {
  currentExportVideosOptions.value = {}
  currentExportImagesOptions.value = {}
  const grid = gridApi.grid
  const selecterRecordList = grid.getCheckboxRecords()
  const selecterRecord = selecterRecordList[0]
  if (selecterRecordList.length == 0) {
    message.warning('请选择需要导出的产品')
    return
  }
  if (selecterRecordList.length > 1) {
    message.warning('一次只能选择一个产品导出图片')
    return
  }
  showImageViewer.value = true;
  downloadImagesModalApi.open()
  currentExportImagesOptions.value = {
    fileName: selecterRecord.title,
    images: [
      {
        name: '主图',
        urls: Array.from(selecterRecord.data?.mainImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: '详情图',
        urls: Array.from(selecterRecord.data?.descImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: 'SKU图',
        urls: selecterRecord.data?.skuImages || []
      }
    ]
  }
  console.log(`🚀 ~ exportImages ~ currentExportImagesOptions.value :`, currentExportImagesOptions.value)
}

function exportVideos() {
  const grid = gridApi.grid
  const selecterRecordList = grid.getCheckboxRecords()
  const selecterRecord = selecterRecordList[0]
  if (selecterRecordList.length == 0) {
    message.warning('请选择需要导出的产品')
    return
  }
  if (selecterRecordList.length > 1) {
    message.warning('一次只能选择一个产品导出视频')
    return
  }
  showVideoViewer.value = true;
  downloadVideosModalApi.open()
  currentExportVideosOptions.value = {
    fileName: selecterRecord.title,
    videos: [
      {
        name: '产品视频',
        urls: Array.from(selecterRecord.data?.videos || []).map((video: any, index: number) => ({
          src: video.url,
          name: video.title || `${selecterRecord.title}-${index + 1}` || ''
        }))
      }
    ]
  }
  console.log(`🚀 ~ exportVideos ~ currentExportVideosOptions.value :`, currentExportVideosOptions.value)
}

function deleteRows() {
  const grid = gridApi.grid
  const selecterRecord = grid.getCheckboxRecords()
  const deleteIds = selecterRecord.map(item => item.id)
  __API__.deleteProduct(deleteIds)
  gridApi.reload()
}

function parseDetailUrl(row: any) {
  __API__.showWindow()
  __API__.loadURL(row.detailUrl)
}

let curTotal = -1
let loopUpdateTimer: any
onMounted(() => {
  loopUpdateTimer = setInterval(async () => {
    const productList = await __API__.getPruductList({ where: { type: 'pdd' } })
    if (curTotal !== productList.data.total) {
      if (curTotal >= 0) gridApi.reload()
      curTotal = productList.data.total
    }
  }, 500)
})

onUnmounted(() => {
  clearInterval(loopUpdateTimer)
})

</script>
<template>
  <Page auto-content-height>
    <Grid :table-title="'多多选品'">
      <template #display_id="{ row }">
        <Button type="link" @click="() => parseDetailUrl(row)">{{ row['title'] }}</Button>
      </template>
      <template #color="{ row }">
        <div>{{ parseColor(row) }}</div>
      </template>
      <template #size="{ row }">
        <div>{{ parseSize(row) }}</div>
      </template>
      <template #presale="{ row }">
        <div>{{ parsePresale(row) }}</div>
      </template>
      <template #remark="{ row }">
        <div>{{ parseRemark(row) }}</div>
      </template>
      <template #toolbar-tools>
        <Button class="mr-2" @click="exportImages()">
          导出图片
        </Button>
        <Button class="mr-2" @click="exportVideos()">
          导出视频
        </Button>
        <Button class="mr-2" type="primary" danger @click="deleteRows()">
          删除
        </Button>
        <Button class="mr-2" type="primary" @click="() => modalApi.open()">
          管理账号
        </Button>
      </template>
    </Grid>
    <accountSessionModel class="w-[80%]" title="账号管理">
      <AccountSessoinViewer :type="'pdd'" :default-url="'https://mobile.yangkeduo.com'" />
    </accountSessionModel>
    <downloadImagesModal class="w-[80%]" title="图片导出">
      <ImageViewer v-if="showImageViewer" ref="imageViewerRef" :options="currentExportImagesOptions" />
    </downloadImagesModal>
    <downloadVideosModal class="w-[80%]" title="视频导出">
      <VideoViewer v-if="showVideoViewer" ref="videoViewerRef" :options="currentExportVideosOptions" />
    </downloadVideosModal>
  </Page>
</template>

<style lang="scss" scoped>
:deep(.vxe-grid) {
  .vxe-grid--layout-header-wrapper {
    overflow: hidden;
  }
}
</style>
