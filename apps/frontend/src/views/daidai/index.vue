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
      gt: 20
    },
    scrollYConfig: {
      enabled: true
    },
    pagerConfig: {
      enabled: false
    },
    checkboxConfig: {
      range: true
    },
    proxyConfig: {
      enabled: true,
      autoLoad: true,
      ajax: {
        query: async () => {
          const result = await __API__.getDaidaiLogs({
            where: { type: 'daidai' },
            pageSize: 10000,
            currentPage: 1
          });
          return result?.data?.items || [];
        }
      }
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

async function deleteRows() {
  const grid = gridApi.grid
  const selecterRecord = grid.getCheckboxRecords()
  const deleteIds = selecterRecord.map(item => item.id)

  try {
    await __API__.deleteDaidaiLogs(deleteIds)

    // 删除成功后重新加载数据
    await gridApi.reload()
  } catch (error) {
    console.error('删除数据失败:', error);
  }
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
let lastDataHash = ''
let loopUpdateTimer: any
let statusCheckTimer: any
let loginStatusCheckTimer: any

// 简单的数据diff算法 - 生成数据哈希用于比较
function generateDataHash(data: any[]): string {
  if (!data || !Array.isArray(data)) return '';

  // 提取关键字段生成哈希字符串
  const keyData = data.map(item => ({
    id: item.id,
    status: item.status,
    message: item.message,
    updatedAt: item.updatedAt
  }));

  return JSON.stringify(keyData);
}

// 检查数据是否发生变化
function hasDataChanged(newData: any[], newTotal: number): boolean {
  const newHash = generateDataHash(newData);
  const totalChanged = curTotal !== newTotal;
  const contentChanged = lastDataHash !== newHash;

  if (totalChanged || contentChanged) {
    lastDataHash = newHash;
    curTotal = newTotal;
    return true;
  }

  return false;
}

onMounted(async () => {
  // 检查初始监控状态
  await checkMonitorStatus();



  // 定期检查日志列表更新
  loopUpdateTimer = setInterval(async () => {
    try {
      const logList = await __API__.getDaidaiLogs({
        where: { type: 'daidai' },
        pageSize: 10000,
        currentPage: 1
      });

      if (logList.data) {
        const newData = logList.data.items || [];
        const newTotal = logList.data.total || 0;
        // 使用diff算法检查数据是否真正发生变化
        if (hasDataChanged(newData, newTotal)) {
          // 直接设置新数据到表格，避免闪烁
          await gridApi.grid.loadData(newData);
        }
      }
    } catch (error) {
      console.error('更新数据失败:', error);
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
    const sessionResult = await __API__.getAccountSessionList({ where: { type: 'daidai' } });
    if (sessionResult.code === 0 && sessionResult.data?.items) {
      checkAndNotifyLoginStatus(sessionResult.data.items);
    }
  } catch (error) {
    console.error('立即检查登录状态失败:', error);
  }

  // 定期检查登录状态并发送通知（每10秒检查一次）
  loginStatusCheckTimer = setInterval(async () => {
    try {
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
    <Grid :table-title="'带带日志监控'">
      <template #remark="{ row }">
        <div>{{ row.message || '-' }}</div>
      </template>
      <template #toolbar-tools>
        <!-- <Button class="mr-2" type="primary" danger @click="deleteRows()">
          删除
        </Button> -->
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
