<script lang="ts" setup>

import type {
  VxeTableGridOptions
} from '#/adapter/vxe-table';

import { Page } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

import { useVbenForm } from '#/adapter/form';
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
    const deliveryDay = localStorage.getItem('deliveryDay')
    if (deliveryDay) {
      formApi.setValues({ deliveryDay })
    }
  },
  async onConfirm() {
    const values = await formApi.getValues()
    if (values.deliveryDay) {
      localStorage.setItem('deliveryDay', values.deliveryDay)
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
            where: { type: 'taobao' },
            pageSize: page.pageSize,
            currentPage: page.currentPage,
            ...formValues
          })
          console.log(result)
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
  row.color = [...new Set(skuList.map((item: any) => item['0']?.name || ''))].join('\n')
  return row.color
}

function parseSize(row: any) {
  const skuList = row.data.skuList || row.data
  row.size = [...new Set(skuList.map((item: any) => item['1']?.name || ''))].join('\n')
  return row.size
}

function parseLimit(row: any): string {
  const skuList = row.data.skuList || row.data
  const specList: string[] = []
  skuList.forEach((item: any) => {
    const skuName = item['0'].name + (item['1']?.name || '')
    if (item.quantityText.includes('有货')) return
    specList.push(`${skuName} ${item.quantityText}`)
  })
  return specList.join('\n')
}

function parsePresale(row: any) {
  const deliveryDay = row.deliveryDay
  const deliveryDaRecord = localStorage.getItem('deliveryDay')
  return {
    deliveryDay,
    overflow: !deliveryDaRecord ? false : Number(deliveryDay) > Number(deliveryDaRecord)
  }
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

  function toImageUrls(images: string[] = []) {
    const a = images.map(url => {
      const tempUrl = String(url).replace('i1', '$').replace('i2', '$').replace('i3', '$').replace('i4', '$')
      return {
        src: url,
        name: '',
        urls: [
          tempUrl.replace('$', 'i1'),
          tempUrl.replace('$', 'i2'),
          tempUrl.replace('$', 'i3'),
          tempUrl.replace('$', 'i4'),
        ]
      }
    })
    console.log(a)
    return a
  }

  currentExportImagesOptions.value = {
    fileName: selecterRecord.title,
    images: [
      {
        name: '主图',
        urls: toImageUrls(selecterRecord.data?.mainImages)
      },
      {
        name: '详情图',
        urls: toImageUrls(selecterRecord.data?.descImages)
      },
      {
        name: 'SKU图',
        urls: selecterRecord.data?.skuImages.map((item: any) => {
          item.src = String(item.src).replaceAll('90x90q30.jpg_', '')
          return item
        }) || []
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
          src: video.video_url,
          name: video.name || `${selecterRecord.title}-${index + 1}` || ''
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
    const productList = await __API__.getPruductList({ where: { type: 'taobao' } })
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
    <Grid :table-title="'淘宝选品'">
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
        <div v-if="parsePresale(row).overflow" style="color: red;">{{ parsePresale(row).deliveryDay }}天</div>
        <div v-else style="color: green;">{{ parsePresale(row).deliveryDay }}天</div>
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
