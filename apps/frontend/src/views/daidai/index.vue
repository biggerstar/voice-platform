<script lang="ts" setup>

import type {
  VxeTableGridOptions
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

import type { CompanyUserApi } from '#/api/company/user';
import AccountSessoinViewer from '#/components/AccountSessoinViewer.vue';
import { onMounted, onUnmounted } from 'vue';
import { useColumns, useGridFormSchema } from './data';
// Socket 实现在 Electron preload 中通过 window 暴露

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
      export: false,
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

function testSocket() {
}

async function startWork() {
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
  <Page class="h-[98%]">
    <Grid :table-title="'带带监控'">
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
        <Button class="mr-2" type="primary" @click="() => startWork()">
          开始运行
        </Button>
        <Button class="mr-2" type="primary" danger @click="deleteRows()">
          删除
        </Button>
        <Button class="mr-2" type="primary" @click="() => modalApi.open()">
          管理账号
        </Button>
        <Button class="mr-2" type="primary" @click="() => testSocket()">
          测试 Socket
        </Button>
      </template>
    </Grid>
    <accountSessionModel class="w-[80%]" title="账号管理">
      <AccountSessoinViewer :type="'pdd'" :default-url="'https://play.daidaimeta.com/index/main'" />
    </accountSessionModel>
  </Page>
</template>

<style lang="scss" scoped>
:deep(.vxe-grid) {
  .vxe-grid--layout-header-wrapper {
    overflow: hidden;
  }
}
</style>
