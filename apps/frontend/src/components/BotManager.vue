<script lang="ts" setup>
import { useVbenForm } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { useVbenModal } from '@vben/common-ui';
import { Button, message } from 'ant-design-vue';
import { onMounted, ref } from 'vue';

// 机器人数据类型（与数据库实体匹配）
interface BotConfig {
  id: string;
  name: string;
  webhookUrl: string;
  created_time: Date;
  updated_time: Date;
}

// 机器人数据存储
const bots = ref<BotConfig[]>([]);

// 加载机器人配置
async function loadBots() {
  try {
    const result = await __API__.getBotList();
    if (result.code === 0 && result.data) {
      bots.value = result.data.items;
      return result.data.items;
    } else {
      console.error('加载机器人列表失败:', result.message);
      bots.value = [];
      return [];
    }
  } catch (error) {
    console.error('加载机器人列表失败:', error);
    bots.value = [];
    return [];
  }
}

const [createModal, createModalApi] = useVbenModal({
  async onConfirm() {
    const values = await createFormApi.getValues();
    
    // 验证 webhook URL 格式
    if (!values.webhookUrl.includes('qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
      message.error('请输入正确的企业微信 webhook 地址');
      return;
    }

    try {
      const result = await __API__.createBot({
        name: values.name,
        webhookUrl: values.webhookUrl
      });

      if (result.code === 0) {
        createModalApi.close();
        gridApi.reload();
        message.success('机器人添加成功');
      } else {
        message.error(result.message || '添加机器人失败');
      }
    } catch (error) {
      console.error('添加机器人失败:', error);
      message.error('添加机器人失败');
    }
  }
});

// 编辑机器人模态框
let editingBot: BotConfig | null = null;
const [editModal, editModalApi] = useVbenModal({
  async onConfirm() {
    if (!editingBot) return;
    
    const values = await editFormApi.getValues();
    
    // 验证 webhook URL 格式
    if (!values.webhookUrl.includes('qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
      message.error('请输入正确的企业微信 webhook 地址');
      return;
    }

    try {
      const result = await __API__.updateBot(editingBot.id, {
        name: values.name,
        webhookUrl: values.webhookUrl
      });

      if (result.code === 0) {
        editModalApi.close();
        gridApi.reload();
        message.success('机器人更新成功');
      } else {
        message.error(result.message || '更新机器人失败');
      }
    } catch (error) {
      console.error('更新机器人失败:', error);
      message.error('更新机器人失败');
    }
  }
});

// 新建表单
const [createForm, createFormApi] = useVbenForm({
  showDefaultActions: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入机器人名称',
      },
      fieldName: 'name',
      label: '机器人名称',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入企业微信 webhook 地址，格式：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
        rows: 3,
      },
      fieldName: 'webhookUrl',
      label: 'Webhook 地址',
      rules: 'required',
    },
  ]
});

// 编辑表单
const [editForm, editFormApi] = useVbenForm({
  showDefaultActions: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入机器人名称',
      },
      fieldName: 'name',
      label: '机器人名称',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入企业微信 webhook 地址，格式：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
        rows: 3,
      },
      fieldName: 'webhookUrl',
      label: 'Webhook 地址',
      rules: 'required',
    },
  ]
});

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
        field: 'name',
        title: '机器人名称',
        minWidth: 150,
      },
      {
        field: 'webhookUrl',
        title: 'Webhook 地址',
        minWidth: 300,
        showOverflow: 'tooltip',
        formatter: ({ cellValue }) => {
          // 只显示 key 部分，隐藏完整 URL
          const match = cellValue.match(/key=([^&]+)/);
          return match ? `...key=${match[1]}` : cellValue;
        }
      },
      {
        field: 'created_time',
        title: '创建时间',
        width: 160,
        formatter: ({ cellValue }) => {
          return new Date(cellValue).toLocaleString();
        }
      },
      {
        field: 'action',
        title: '操作',
        width: 150,
        slots: {
          default: 'action'
        }
      },
    ],
    height: '400px',
    keepSource: true,
    showOverflow: true,
    pagerConfig: {
      enabled: false
    },
    checkboxConfig: {
      range: true
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          return await loadBots();
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

// 删除选中的机器人
async function deleteSelectedBots() {
  const grid = gridApi.grid;
  const selectedRecords = grid.getCheckboxRecords();
  
  if (selectedRecords.length === 0) {
    message.warning('请选择要删除的机器人');
    return;
  }

  try {
    const selectedIds = selectedRecords.map(record => record.id);
    const result = await __API__.deleteBot(selectedIds);
    
    if (result.code === 0) {
      gridApi.reload();
      message.success(`已删除 ${selectedRecords.length} 个机器人`);
    } else {
      message.error(result.message || '删除机器人失败');
    }
  } catch (error) {
    console.error('删除机器人失败:', error);
    message.error('删除机器人失败');
  }
}

// 编辑机器人
function editBot(row: BotConfig) {
  editingBot = row;
  editFormApi.setValues({
    name: row.name,
    webhookUrl: row.webhookUrl
  });
  editModalApi.open();
}

// 测试 webhook
async function testWebhook(row: BotConfig) {
  try {
    const response = await fetch(row.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: `🤖 机器人测试消息 - ${row.name}\n时间：${new Date().toLocaleString()}`
        }
      })
    });

    const result = await response.json();
    
    if (result.errcode === 0) {
      message.success('测试消息发送成功');
    } else {
      message.error(`测试失败：${result.errmsg || '未知错误'}`);
    }
  } catch (error) {
    console.error('测试 webhook 失败:', error);
    message.error('测试失败：网络错误');
  }
}

// 导出机器人列表供其他组件使用
function getBotsList(): BotConfig[] {
  return bots.value;
}

// 根据名称获取机器人配置
function getBotByName(name: string): BotConfig | undefined {
  return bots.value.find((bot: BotConfig) => bot.name === name);
}

// 暴露方法给父组件
defineExpose({
  getBotsList,
  getBotByName,
  loadBots
});

onMounted(() => {
  loadBots();
  gridApi.query();
});
</script>

<template>
  <div>
    <Grid table-title="机器人管理">
      <template #action="{ row }">
        <Button class="mr-2" type="primary" size="small" @click="editBot(row)">
          编辑
        </Button>
        <Button type="default" size="small" @click="testWebhook(row)">
          测试
        </Button>
      </template>
      <template #toolbar-tools>
        <Button class="mr-2" type="primary" danger @click="deleteSelectedBots()">
          删除选中
        </Button>
        <Button class="mr-2" type="primary" @click="() => createModalApi.open()">
          添加机器人
        </Button>
      </template>
    </Grid>

    <!-- 新建机器人模态框 -->
    <createModal class="w-[600px]" title="添加机器人">
      <createForm />
    </createModal>

    <!-- 编辑机器人模态框 -->
    <editModal class="w-[600px]" title="编辑机器人">
      <editForm />
    </editModal>
  </div>
</template>

<style lang="scss" scoped>
:deep(.vxe-grid) {
  .vxe-grid--layout-header-wrapper {
    overflow: hidden;
  }
}
</style>
