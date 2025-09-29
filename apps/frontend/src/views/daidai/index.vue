<script lang="ts" setup>

import type {
  VxeTableGridOptions
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

import type { CompanyUserApi } from '#/api/company/user';
import AccountSessoinViewer from '#/components/AccountSessoinViewer.vue';
import BotManager from '#/components/BotManager.vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useColumns, useGridFormSchema } from './data';
import { checkAndNotifyLoginStatus } from './loginStatusNotification';

// Socket 实现在 Electron preload 中通过 window 暴露

// ==================== 状态管理 ====================
// 监控状态管理
const isMonitoring = ref(false); // 是否正在监控
const isOperating = ref(false); // 是否正在执行操作（防快速点击）
const activeTaskCount = ref(0); // 当前活跃的任务数量

// 统计数据管理
const enterRoomCount = ref(0); // 进房发送次数
const wealthRankCount = ref(0); // 财富榜发送次数

// 数据更新状态
let curTotal = -1
let lastDataHash = ''
let loopUpdateTimer: any
let statusCheckTimer: any
let loginStatusCheckTimer: any
let statsUpdateTimer: any

// ==================== 计算属性 ====================
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

// ==================== 模态框配置 ====================
// 账号会话管理模态框
const [accountSessionModel, accountModalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '关闭窗口',
  async onConfirm() {
    accountModalApi.close()
  },
});

// 机器人管理模态框
const [botManagerModal, botModalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '关闭窗口',
  async onConfirm() {
    botModalApi.close()
  },
});

// ==================== 表格配置 ====================
const [Grid, gridApi] = useVbenVxeGrid({
  showSearchForm: false,
  formOptions: {
    schema: useGridFormSchema(),
    compact: true,
    submitOnChange: true,
    showCollapseButton: false,
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

// ==================== 数据操作函数 ====================
// 删除选中行
async function deleteRows() {
  const grid = gridApi.grid
  const selecterRecord = grid.getCheckboxRecords()
  const deleteIds = selecterRecord.map(item => item.id)

  try {
    await __API__.deleteDaidaiLogs(deleteIds)
    await gridApi.reload()
  } catch (error) {
    console.error('删除数据失败:', error);
  }
}

// 处理重连按钮点击
async function handleReconnect(row: any) {
  try {
    console.log('重连房间:', row);
    await __API__.reconnectRoom({
      roomId: row.roomId,
      accountSessionId: row.accountSessionId,
      chatroomName: row.chatroomName
    });
    message.success('重连请求已发送');
  } catch (error) {
    console.error('重连失败:', error);
    message.error('重连失败');
  }
}

// ==================== 监控状态管理函数 ====================
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

// ==================== 统计数据管理函数 ====================
// 获取统计数据
async function getStatisticsData() {
  try {
    const result = await __API__.getDaidaiStats();
    if (result.success && result.data) {
      enterRoomCount.value = result.data.enterRoomCount || 0;
      wealthRankCount.value = result.data.wealthRankCount || 0;
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
  }
}

// 重置统计数据
async function resetStatistics() {
  try {
    const result = await __API__.resetDaidaiStats();
    if (result.success) {
      enterRoomCount.value = 0;
      wealthRankCount.value = 0;
    } else {
      message.error('重置统计数据失败');
    }
  } catch (error) {
    console.error('重置统计数据失败:', error);
    message.error('重置统计数据失败');
  }
}

// 验证 webhook 配置
async function validateWebhookConfig(sessions: any[]): Promise<{ valid: boolean; message: string }> {
  try {
    // 提取所有 session ID
    const sessionIds = sessions.map(session => session.id);

    // 调用后端验证函数
    const result = await __API__.validateSessionsWebhook(sessionIds);

    if (!result.success) {
      const errorMessages: string[] = [];

      // 检查普通机器人绑定
      if (result.unboundSessions && result.unboundSessions.length > 0) {
        const unboundSessionNames = result.unboundSessions
          .map((sessionId: string) => {
            const session = sessions.find(s => s.id === sessionId);
            return session ? session.name : sessionId;
          })
          .join('、');
        errorMessages.push(`以下账号未绑定普通机器人：${unboundSessionNames}`);
      }

      // 检查榜单机器人绑定
      if (result.unboundLeaderboardSessions && result.unboundLeaderboardSessions.length > 0) {
        const unboundLeaderboardSessionNames = result.unboundLeaderboardSessions
          .map((sessionId: string) => {
            const session = sessions.find(s => s.id === sessionId);
            return session ? session.name : sessionId;
          })
          .join('、');
        errorMessages.push(`以下账号未绑定榜单机器人：${unboundLeaderboardSessionNames}`);
      }

      return {
        valid: false,
        message: `${errorMessages.join('；')}。请先在账号管理中配置并绑定相应的机器人后再开始监控`
      };
    }

    return { valid: true, message: '' };
  } catch (error: any) {
    console.error('验证 webhook 配置失败:', error);
    return {
      valid: false,
      message: `验证机器人配置失败：${error?.message || '未知错误'}`
    };
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

    // 过滤出启用的账号
    const enabledSessions = sessionResult.data.items.filter((session: any) => 
      session.enabled !== false
    );

    if (enabledSessions.length === 0) {
      message.error('没有启用的账号，请先启用至少一个账号');
      return;
    }

    // 检查账号登录状态
    const unloggedAccounts = enabledSessions.filter((session: any) =>
      session.login_status !== '已登录'
    );

    if (unloggedAccounts.length > 0) {
      const accountNames = unloggedAccounts.map((account: any) => account.name).join('、');
      message.error(`以下启用的账号未登录：${accountNames}，请先登录后再开始监控`);
      return;
    }

    // 检查房间数据
    const accountsWithoutRooms = enabledSessions.filter((session: any) =>
      !session.data?.rooms || session.data.rooms.length === 0
    );

    if (accountsWithoutRooms.length > 0) {
      const accountNames = accountsWithoutRooms.map((account: any) => account.name).join('、');
      message.error(`以下启用的账号没有房间数据：${accountNames}，请先配置房间后再开始监控`);
      return;
    }

    // 验证 webhook 配置
    const webhookValidation = await validateWebhookConfig(enabledSessions);
    if (!webhookValidation.valid) {
      message.error(webhookValidation.message);
      return;
    }

    let taskList = [];
    const defaultUrl = 'https://play.daidaimeta.com/index/main';

    // 使用启用的会话数据
    taskList = enabledSessions.map((session: any) => ({
      name: session.name,
      type: 'daidai',
      url: defaultUrl
    }));

    const result = await __API__.startMirrorTask(taskList);

    if (result.success) {
      console.log('监控任务启动成功:', result);
      await checkMonitorStatus(); // 更新状态
      await resetStatistics(); // 重置统计数据
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
  if (isOperating.value) {
    return;
  }

  await checkMonitorStatus();

  if (isMonitoring.value) {
    await stopMonitoring();
  } else {
    await startMonitoring();
  }
}

// ==================== 事件处理函数 ====================
// 处理子组件的浏览器打开事件
function handleBrowserOpened(row: any) {
  console.log('浏览器已打开:', row);
  accountModalApi.close();
}

// ==================== 数据更新函数 ====================
// 简单的数据diff算法 - 生成数据哈希用于比较
function generateDataHash(data: any[]): string {
  if (!data || !Array.isArray(data)) return '';

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

// ==================== 生命周期钩子 ====================
onMounted(async () => {
  // 检查初始监控状态
  await checkMonitorStatus();
  
  // 初始化统计数据
  await getStatisticsData();

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
        if (hasDataChanged(newData, newTotal)) {
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

  // 定期更新统计数据（每3秒更新一次）
  statsUpdateTimer = setInterval(async () => {
    await getStatisticsData();
  }, 3000)

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
  clearInterval(statsUpdateTimer)
  clearInterval(loginStatusCheckTimer)
})

</script>
<template>
  <Page class="h-[98%]">
    <Grid :table-title="'带带日志监控'">
      <template #remark="{ row }">
        <div>{{ row.message || '-' }}</div>
      </template>
      <template #action="{ row }">
        <Button v-if="row.status === 'error'" type="primary" size="small" @click="handleReconnect(row)">
          重连
        </Button>
      </template>
      <template #toolbar-tools>
        <!-- 统计信息显示 -->
        <div class="mr-4 flex items-center space-x-4 text-sm">
          <div class="flex items-center space-x-1">
            <span class="text-gray-600">进房发送:</span>
            <span class="font-semibold text-blue-600">{{ enterRoomCount }}</span>
          </div>
          <div class="flex items-center space-x-1">
            <span class="text-gray-600">财富榜发送:</span>
            <span class="font-semibold text-green-600">{{ wealthRankCount }}</span>
          </div>
          <Button size="small" type="text" @click="resetStatistics" title="重置统计数据">
            重置
          </Button>
        </div>
        
        <Button class="mr-2" type="default" @click="() => botModalApi.open()">
          机器人管理
        </Button>
        <Button class="mr-2" type="default" @click="() => accountModalApi.open()">
          账号管理
        </Button>
        <Button class="mr-2" type="primary" :danger="monitorButtonDanger" :loading="isOperating" :disabled="isOperating"
          @click="() => startWork()">
          {{ monitorButtonText }}
        </Button>
      </template>
    </Grid>

    <!-- 账号管理模态框 -->
    <accountSessionModel class="w-[80%]" title="账号管理">
      <AccountSessoinViewer :type="'daidai'" :default-url="'https://play.daidaimeta.com/index/main'"
        @browser-opened="handleBrowserOpened" />
    </accountSessionModel>

    <!-- 机器人管理模态框 -->
    <botManagerModal class="w-[80%]" title="机器人管理">
      <BotManager />
    </botManagerModal>
  </Page>
</template>

<style lang="scss" scoped>
:deep(.vxe-grid) {
  .vxe-grid--layout-header-wrapper {
    overflow: hidden;
  }
}
</style>
