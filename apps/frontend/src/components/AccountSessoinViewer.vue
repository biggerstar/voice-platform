<script lang="ts" setup>
import { useVbenForm } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { useVbenModal } from '@vben/common-ui';
import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { onMounted } from 'vue';

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
        type: 'pdd',
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
      .split(/[,，]/)
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
        rows: 5,
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
      label: '会话名称',
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
function deleteRows() {
  const grid = gridApi.grid
  const selecterRecord = grid.getCheckboxRecords()
  const deleteIds = selecterRecord.map(item => item.id)
  if (deleteIds.length === 0) {
    return
  }
  __API__.deleteAccountSession(deleteIds)
  gridApi.reload()
}

function openBrowser(row: any) {
  console.log(`🚀 ~ openBrowser ~ row:`, row)
  __API__.reopenBrowser({
    url: defaultUrl,
    type: 'pdd',
    name: row.name
  })
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

onMounted(() => {
  gridApi.reload()
})
</script>

<template>
  <Grid :table-title="`房间会话管理`">
    <template #data="{ row }">
      <div style="max-height: 100px; overflow-y: auto; font-size: 12px; white-space: pre-wrap;">
        {{ formatData(row.data) }}
      </div>
    </template>
    <template #action="{ row }">
      <Button class="mr-2" type="primary" @click="openBrowser(row)">
        打开
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
        添加房间会话
      </Button>
      <createModal class="w-[600px]" title="房间管理">
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
