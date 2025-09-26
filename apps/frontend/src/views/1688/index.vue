<script lang="ts" setup>

import type {
  VxeTableGridOptions
} from '#/adapter/vxe-table';

import { Page } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import type { CompanyUserApi } from '#/api/company/user';
import ImageViewer from '#/components/ImageViewer.vue';
import VideoViewer from '#/components/VideoViewer.vue';
import { useVbenModal } from '@vben/common-ui';
import { onMounted, onUnmounted, ref } from 'vue';
import { useColumns, useGridFormSchema, useSettingFrom } from './data';

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

const [settingModal, modalApi] = useVbenModal({
  onOpened() {
    const stockLimit = localStorage.getItem('stockLimit')
    if (stockLimit) {
      formApi.setValues({ stockLimit })
    }
  },
  async onConfirm() {
    const values = await formApi.getValues()
    if (values.stockLimit) {
      localStorage.setItem('stockLimit', values.stockLimit)
    }
    gridApi.query()
    modalApi.close()
  }
});
const [settingForm, formApi] = useVbenForm({
  showDefaultActions: false,
  schema: useSettingFrom()
})

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
        'limit',
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
            where: { type: '1688' },
            pageSize: page.pageSize,
            currentPage: page.currentPage,
            ...formValues
          })
          console.log(`🚀 ~ query: ~ result:`, result)
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
  const skuList = row.data.skuList || row.data
  row.color = [...new Set(skuList.map((item: any) => item.specAttrs.split(';')[0]))].join('\n')
  return row.color
}

function parseSize(row: any) {
  const skuList = row.data.skuList || row.data
  row.size = [...new Set(skuList.map((item: any) => item.specAttrs.split(';')[1]))].join('\n')
  return row.size
}

function parsePresale(row: any) {
  return row.title.includes('预售') ? '是' : ''
}

function parseLimit(row: any): string {
  const skuList = row.data.skuList || row.data
  const specList: string[] = []
  const stockLimit = localStorage.getItem('stockLimit')
  if (!stockLimit) return ''
  skuList.forEach((item: any) => {
    const canBookCount = item.canBookCount
    if (stockLimit <= canBookCount) return
    specList.push(`${item.specAttrs} - 库存 ${item.canBookCount}`)
  })
  row.stockLimitString = specList.join('\n')
  return row.stockLimitString
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
          src: video.videoUrl,
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
    const productList = await __API__.getPruductList({ where: { type: '1688' } })
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
    <Grid :table-title="'1688选品'">
      <template #display_id="{ row }">
        <Button type="link" @click="()=> parseDetailUrl(row)">{{ row['title'] }}</Button>
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
      <template #limit="{ row }">
        <div>{{ parseLimit(row) }}</div>
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
          配置
        </Button>
        <settingModal class="w-[600px]" title="配置">
          <settingForm></settingForm>
        </settingModal>
        <downloadImagesModal class="w-[80%]" title="图片导出">
          <ImageViewer v-if="showImageViewer" ref="imageViewerRef" :options="currentExportImagesOptions" />
        </downloadImagesModal>
        <downloadVideosModal class="w-[80%]" title="视频导出">
          <VideoViewer v-if="showVideoViewer" ref="videoViewerRef" :options="currentExportVideosOptions" />
        </downloadVideosModal>
      </template>
    </Grid>
  </Page>
</template>

<style lang="scss" scoped>
:deep(.vxe-grid) {
  .vxe-grid--layout-header-wrapper {
    overflow: hidden;
  }
}
</style>
