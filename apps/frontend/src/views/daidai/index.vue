<script lang="ts" setup>

import type {
  VxeTableGridOptions
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

import type { CompanyUserApi } from '#/api/company/user';
import AccountSessoinViewer from '#/components/AccountSessoinViewer.vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useColumns, useGridFormSchema } from './data';
import { checkAndNotifyLoginStatus } from './loginStatusNotification';
// Socket 实现在 Electron preload 中通过 window 暴露

// 监控状态管理
const isMonitoring = ref(false); // 是否正在监控
const isOperating = ref(false); // 是否正在执行操作（防快速点击）
const activeTaskCount = ref(0); // 当前活跃的任务数量

// 计算按钮文本和样式
const monitorButtonText = computed(() => {
  if (isOperating.value) {
    return isMonitoring.value ? '停止中...' : '启动中...';
  }
  return isMonitoring.value ? '停止监控' : '开始监控';
});

const monitorButtonDanger = computed(() => {
  return isMonitoring.value;
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
            where: { type: 'daidai' },
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

// 检查监控状态
async function checkMonitorStatus() {
  try {
    const result = await __API__.getMirrorTaskStatus();
    if (result.success) {
      isMonitoring.value = result.isRunning || false;
      activeTaskCount.value = result.activeCount || 0;
    }
  } catch (error) {
    console.error('检查监控状态失败:', error);
  }
}

// 开始监控
async function startMonitoring() {
  if (isOperating.value) {
    console.warn('操作进行中，请稍候...');
    return;
  }

  try {
    isOperating.value = true;

    // 获取账号会话列表作为任务配置
    const sessionResult = await __API__.getAccountSessionList({ where: { type: 'daidai' } });
    console.info(`🚀 ~ startMonitoring ~ sessionResult:`, sessionResult)

    // 检查是否有账号
    if (sessionResult.code !== 0 || !sessionResult.data?.items?.length) {
      message.error('没有找到可用的账号，请先添加账号');
      return;
    }

    // 检查账号登录状态
    const unloggedAccounts = sessionResult.data.items.filter((session: any) =>
      session.login_status !== '已登录'
    );

    if (unloggedAccounts.length > 0) {
      const accountNames = unloggedAccounts.map((account: any) => account.name).join('、');
      message.error(`以下账号未登录：${accountNames}，请先登录后再开始监控`);
      return;
    }

    // 检查房间数据
    const accountsWithoutRooms = sessionResult.data.items.filter((session: any) =>
      !session.data?.rooms || session.data.rooms.length === 0
    );

    if (accountsWithoutRooms.length > 0) {
      const accountNames = accountsWithoutRooms.map((account: any) => account.name).join('、');
      message.error(`以下账号没有房间数据：${accountNames}，请先配置房间后再开始监控`);
      return;
    }

    let taskList = [];
    const defaultUrl = 'https://play.daidaimeta.com/index/main';

    // 使用真实的会话数据
    taskList = sessionResult.data.items.map((session: any) => ({
      name: session.name,
      type: 'daidai',
      url: defaultUrl
    }));

    const result = await __API__.startMirrorTask(taskList);

    if (result.success) {
      console.log('监控任务启动成功:', result);
      await checkMonitorStatus(); // 更新状态
    } else {
      console.error('监控任务启动失败:', result.error);
    }

  } catch (error) {
    console.error('启动监控失败:', error);
  } finally {
    isOperating.value = false;
  }
}

// 停止监控
async function stopMonitoring() {
  if (isOperating.value) {
    console.warn('操作进行中，请稍候...');
    return;
  }

  try {
    isOperating.value = true;

    console.log('开始停止监控任务');

    // 停止所有镜像任务
    const result = await __API__.stopMirrorTask();

    if (result.success) {
      console.log('监控任务停止成功:', result);
      await checkMonitorStatus(); // 更新状态
    } else {
      console.error('监控任务停止失败:', result.error);
    }

  } catch (error) {
    console.error('停止监控失败:', error);
  } finally {
    isOperating.value = false;
  }
}

// 主要的工作函数 - 根据当前状态决定启动或停止
async function startWork() {
  // 防止快速点击
  if (isOperating.value) {
    return;
  }

  // 先检查当前状态
  await checkMonitorStatus();

  if (isMonitoring.value) {
    // 如果正在监控，则停止
    await stopMonitoring();
  } else {
    // 如果没有监控，则开始
    await startMonitoring();
  }
}

// 处理子组件的浏览器打开事件
function handleBrowserOpened(row: any) {
  console.log('浏览器已打开:', row);
  // 关闭账号管理模态窗口
  modalApi.close();
}


let curTotal = -1
let loopUpdateTimer: any
let statusCheckTimer: any
let loginStatusCheckTimer: any

onMounted(async () => {
  // 检查初始监控状态
  await checkMonitorStatus();

  // 定期检查产品列表更新
  loopUpdateTimer = setInterval(async () => {
    const productList = await __API__.getPruductList({ where: { type: 'daidai' } })
    if (curTotal !== productList.data.total) {
      if (curTotal >= 0) gridApi.reload()
      curTotal = productList.data.total
    }
  }, 500)

  // 定期检查监控状态（每5秒检查一次）
  statusCheckTimer = setInterval(async () => {
    if (!isOperating.value) {
      await checkMonitorStatus();
    }
  }, 5000)

  // 立即执行一次登录状态检查
  try {
    console.log('🚀 立即执行登录状态检查')
    const sessionResult = await __API__.getAccountSessionList({ where: { type: 'daidai' } });
    console.log('📋 获取账号会话列表结果:', sessionResult)
    if (sessionResult.code === 0 && sessionResult.data?.items) {
      checkAndNotifyLoginStatus(sessionResult.data.items);
    }
  } catch (error) {
    console.error('立即检查登录状态失败:', error);
  }

  // 定期检查登录状态并发送通知（每10秒检查一次）
  loginStatusCheckTimer = setInterval(async () => {
    try {
      console.log('⏰ 定时检查登录状态')
      const sessionResult = await __API__.getAccountSessionList({ where: { type: 'daidai' } });
      if (sessionResult.code === 0 && sessionResult.data?.items) {
        checkAndNotifyLoginStatus(sessionResult.data.items);
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  }, 10000)
})

onUnmounted(() => {
  clearInterval(loopUpdateTimer)
  clearInterval(statusCheckTimer)
  clearInterval(loginStatusCheckTimer)
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
        <Button class="mr-2" type="primary" danger @click="deleteRows()">
          删除
        </Button>
        <Button class="mr-2" type="primary" @click="() => modalApi.open()">
          管理账号
        </Button>
        <Button class="mr-2" type="primary" :danger="monitorButtonDanger" :loading="isOperating" :disabled="isOperating"
          @click="() => startWork()">
          {{ monitorButtonText }}
        </Button>
      </template>
    </Grid>
    <accountSessionModel class="w-[80%]" title="账号管理">
      <AccountSessoinViewer :type="'daidai'" :default-url="'https://play.daidaimeta.com/index/main'"
        @browser-opened="handleBrowserOpened" />
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
