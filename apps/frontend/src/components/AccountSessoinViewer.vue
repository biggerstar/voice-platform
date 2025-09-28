<script lang="ts" setup>
import { useVbenForm } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { useVbenModal } from '@vben/common-ui';
import { Button, message, Select, Switch } from 'ant-design-vue';
import dayjs from 'dayjs';
import { onMounted, onUnmounted, ref } from 'vue';

const { type, defaultUrl } = defineProps({
  type: {
    type: String,
    default: ''
  },
  defaultUrl: {
    type: String,
    default: 'about:blank'
  }
})

const emit = defineEmits(['browser-opened'])

// 机器人列表状态
const botsList = ref<Array<{ id: string; name: string; webhookUrl: string }>>([]);

// 加载机器人列表
const loadBotsList = async () => {
  try {
    const result = await __API__.getBotList();
    if (result.code === 0 && result.data) {
      botsList.value = result.data.items.map(bot => ({
        id: bot.id,
        name: bot.name,
        webhookUrl: bot.webhookUrl
      }));
    } else {
      console.error('加载机器人列表失败:', result.message);
      botsList.value = [];
    }
  } catch (error) {
    console.error('加载机器人列表失败:', error);
    botsList.value = [];
  }
};

// 处理 webhook 绑定变更
const handleWebhookChange = async (sessionId: string, botName: any) => {
  try {
    if (!botName || typeof botName !== 'string') {
      // 清除绑定
      await __API__.updateAccountSession(sessionId, {
        webhook_bot: null,
        webhook_url: null
      });
      message.success('已清除机器人绑定');
      gridApi.reload();
      return;
    }

    const selectedBot = botsList.value.find(bot => bot.name === botName);
    if (!selectedBot) {
      message.error('未找到选中的机器人');
      return;
    }

    await __API__.updateAccountSession(sessionId, {
      webhook_bot: botName,
      webhook_url: selectedBot.webhookUrl
    });
    
    message.success('机器人绑定成功');
    gridApi.reload();
  } catch (error) {
    console.error('绑定机器人失败:', error);
    message.error('绑定机器人失败');
  }
};

// 处理榜单机器人绑定变更
const handleLeaderboardBotChange = async (sessionId: string, botName: any) => {
  try {
    if (!botName || typeof botName !== 'string') {
      // 清除绑定
      await __API__.updateAccountSession(sessionId, {
        leaderboard_bot: null,
        leaderboard_webhook_url: null
      });
      message.success('已清除榜单机器人绑定');
      gridApi.reload();
      return;
    }

    const selectedBot = botsList.value.find(bot => bot.name === botName);
    if (!selectedBot) {
      message.error('未找到选中的榜单机器人');
      return;
    }

    await __API__.updateAccountSession(sessionId, {
      leaderboard_bot: botName,
      leaderboard_webhook_url: selectedBot.webhookUrl
    });
    
    message.success('榜单机器人绑定成功');
    gridApi.reload();
  } catch (error) {
    console.error('绑定榜单机器人失败:', error);
    message.error('绑定榜单机器人失败');
  }
};

// 处理启用状态变更
const handleEnabledChange = async (sessionId: string, enabled: boolean) => {
  try {
    await __API__.updateAccountSession(sessionId, {
      enabled: enabled
    });
    
    message.success(enabled ? '已启用账号' : '已禁用账号');
    gridApi.reload();
  } catch (error) {
    console.error('更新启用状态失败:', error);
    message.error('更新启用状态失败');
  }
};

// 日期格式化函数
const formatTimeField = (time: string | Date | null): string => {
  if (!time) return '';
  try {
    return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
  } catch (error) {
    return time.toString() || '';
  }
};

// 新建会话模态框
const [createModal, createModalApi] = useVbenModal({
  async onConfirm() {
    const values = await createFormApi.getValues()
    console.log(values)
    try {
      // 处理 data 字段，如果是字符串则尝试解析为 JSON
      let processedData = values.data
      if (typeof values.data === 'string') {
        try {
          processedData = JSON.parse(values.data)
        } catch (error) {
          console.error('JSON 解析失败:', error)
          return
        }
      }

      const isSuccess = await __API__.createAccountSession({
        ...values,
        type: 'daidai',
        data: processedData
      })
      if (!isSuccess) {
        message.warn('名称已存在')
        return
      }
      createModalApi.close()
      gridApi.reload()
    } catch (error) {
      console.error('创建会话失败:', error)
    }
  }
});

// 配置房间模态框
let currentRowData: any = null
const [ConfigModal, configModalApi] = useVbenModal({
  async onConfirm() {
    const values = await configFormApi.getValues()
    const roomText = values.rooms || ''

    // 解析房间：按逗号分隔并去除空格
    const rooms = roomText
      .split(/[,，\n]/)
      .map((room: string) => room.trim())
      .filter((room: string) => room.length > 0)

    if (rooms.length === 0) {
      message.warn('请输入至少一个房间')
      return
    }

    if (!currentRowData) {
      message.warn('未找到当前行数据')
      return
    }

    // 在这里处理配置房间的逻辑
    await __API__.updateAccountSession(currentRowData.id, {
      data: { rooms },
    })

    configModalApi.close()
    message.success(`已配置 ${rooms.length} 个房间`)
    gridApi.reload()
  }
});

// 配置房间表单
const [configForm, configFormApi] = useVbenForm({
  showDefaultActions: false,
  schema: [
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入房间，多个房间用逗号分隔，例如：房间1,房间2,房间3',
        rows: 25,
      },
      fieldName: 'rooms',
      label: '房间配置',
      rules: 'required',
    },
  ]
})

// 新建表单
const [createForm, createFormApi] = useVbenForm({
  showDefaultActions: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入会话名称',
      },
      fieldName: 'name',
      label: '账号名称',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入备注信息',
        rows: 3,
      },
      fieldName: 'remark',
      label: '备注',
    },
  ]
})

// 表格配置
const [Grid, gridApi] = useVbenVxeGrid({
  showSearchForm: false,
  gridOptions: {
    columns: [
      {
        type: 'checkbox',
        title: '',
        width: 50,
      },
      {
        field: 'id',
        title: 'ID',
        width: 120,
        visible: false,
      },
      {
        field: 'name',
        title: '会话名称',
        minWidth: 150,
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 200,
      },
      {
        field: 'login_status',
        title: '登录状态',
        width: 100,
        slots: {
          default: 'login_status'
        }
      },
      {
        field: 'webhook_bot',
        title: '绑定机器人',
        width: 150,
        slots: {
          default: 'webhook_bot'
        }
      },
      {
        field: 'leaderboard_bot',
        title: '榜单机器人',
        width: 150,
        slots: {
          default: 'leaderboard_bot'
        }
      },
      {
        field: 'enabled',
        title: '启用状态',
        width: 100,
        slots: {
          default: 'enabled'
        }
      },
      {
        field: 'created_time',
        title: '创建时间',
        width: 160,
        sortable: true,
        visible: false,
        formatter: ({ cellValue }) => formatTimeField(cellValue),
      },
      {
        field: 'updated_time',
        title: '更新时间',
        width: 160,
        sortable: true,
        visible: false,
        formatter: ({ cellValue }) => formatTimeField(cellValue),
      },
      {
        field: 'action',
        title: '操作',
        width: 260,
        slots: {
          default: 'action'
        }
      },
    ],
    height: '600px',
    keepSource: true,
    showOverflow: true,
    pagerConfig: {
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
      autoHidden: true
    },
    checkboxConfig: {
      range: true
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await __API__.getAccountSessionList({
            where: type ? { type } : {},
            pageSize: page.pageSize,
            currentPage: page.currentPage,
            ...formValues
          })

          return result.data
        },
      },
    },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: { code: 'query' },
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions,
});

// 删除选中行
async function deleteRows() {
  const grid = gridApi.grid
  const selecterRecord = grid.getCheckboxRecords()
  const deleteIds = selecterRecord.map(item => item.id)
  if (deleteIds.length === 0) {
    message.warning('请先选择要删除的账号会话')
    return
  }
  
  try {
    const result = await __API__.deleteAccountSession(deleteIds)
    
    if (result && result.success === false) {
      // 如果有账号正在使用中，显示警告信息
      message.error(result.message)
      return
    }
    
    // 删除成功
    message.success(result?.message || '删除成功')
    gridApi.reload()
  } catch (error) {
    console.error('删除账号会话失败:', error)
    message.error('删除账号会话失败')
  }
}

function openBrowser(row: any) {
  console.log(`🚀 ~ openBrowser ~ row:`, row)
  __API__.reopenBrowser({
    url: defaultUrl,
    type: 'daidai',
    name: row.name
  })
  // 发送事件给父组件
  emit('browser-opened', row)
}

function openConfigModal(row: any) {
  currentRowData = row
  // 从 currentRowData 加载数据
  const savedRooms = row.data?.rooms || []
  // 重置表单并填充数据
  configFormApi.setValues({ rooms: savedRooms.join(', ') })
  configModalApi.open()
}

// 格式化数据显示
function formatData(data: any) {
  if (!data) return ''
  try {
    if (typeof data === 'string') {
      return data
    }
    return JSON.stringify(data, null, 2)
  } catch (error) {
    return String(data)
  }
}

// 定时器引用
const refreshTimer = ref<NodeJS.Timeout | null>(null)

onMounted(() => {
  loadBotsList();
  gridApi.query()
  refreshTimer.value = setInterval(() => {
    loadBotsList(); // 定期刷新机器人列表
    gridApi.query();
  }, 20000)
})

onUnmounted(() => {
  // 清理定时器
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
})
</script>

<template>
  <Grid :table-title="``">
    <template #data="{ row }">
      <div style="max-height: 100px; overflow-y: auto; font-size: 12px; white-space: pre-wrap;">
        {{ formatData(row.data) }}
      </div>
    </template>
    <template #login_status="{ row }">
      <span :style="{ color: row.login_status === '已登录' ? '#52c41a' : '#ff4d4f' }">
        {{ row.login_status || '未登录' }}
      </span>
    </template>
    <template #webhook_bot="{ row }">
      <Select
        :value="row.webhook_bot"
        placeholder="选择机器人"
        style="width: 100%"
        allow-clear
        @change="(value) => handleWebhookChange(row.id, value)"
      >
        <Select.Option
          v-for="bot in botsList"
          :key="bot.id"
          :value="bot.name"
        >
          {{ bot.name }}
        </Select.Option>
      </Select>
    </template>
    <template #leaderboard_bot="{ row }">
      <Select
        :value="row.leaderboard_bot"
        placeholder="选择榜单机器人"
        style="width: 100%"
        allow-clear
        @change="(value) => handleLeaderboardBotChange(row.id, value)"
      >
        <Select.Option
          v-for="bot in botsList"
          :key="bot.id"
          :value="bot.name"
        >
          {{ bot.name }}
        </Select.Option>
      </Select>
    </template>
    <template #enabled="{ row }">
      <Switch
        :checked="row.enabled !== false"
        @change="(checked) => handleEnabledChange(row.id, !!checked)"
      />
    </template>
    <template #action="{ row }">
      <Button class="mr-2" type="default" @click="openBrowser(row)">
       预登录
      </Button>
      <Button class="mr-2" type="primary" @click="openConfigModal(row)">
        配置房间
      </Button>
    </template>
    <template #toolbar-tools>
      <Button class="mr-2" type="primary" danger @click="deleteRows()">
        删除
      </Button>
      <Button class="mr-2" type="primary" @click="() => createModalApi.open()">
        添加账号
      </Button>
      <createModal class="w-[600px]" title="账号管理">
        <createForm></createForm>
      </createModal>
      <ConfigModal class="w-[600px]" title="配置房间">
        <configForm></configForm>
      </ConfigModal>
    </template>
  </Grid>
</template>

<style lang="scss" scoped>
:deep(.vxe-grid) {
  .vxe-grid--layout-header-wrapper {
    overflow: hidden;
  }
}
</style>
