import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import { $t } from '#/locales';
import dayjs from 'dayjs';

// 日期格式化函数
const formatTimeField = (time: string | null): string => {
  if (!time) return '';
  try {
    return dayjs(+time).subtract(8, 'hour').format('MM-DD HH:mm:ss');
  } catch (error) {
    return time || '';
  }
};

export function useSettingFrom(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入最高配送天数',
      },
      fieldName: 'deliveryDay',
      label: '配送天数',
    },
  ]
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.user.username'),
    },
    {
      component: 'Input',
      fieldName: 'nickname',
      label: $t('system.user.nickname'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        options: [
          { label: '广场', value: '广场' },
          { label: '推荐', value: '推荐' },
          { label: '热门', value: '热门' },
        ],
      },
      fieldName: 'status',
      label: '来源',
    },
  ];
}

export function useColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      type: 'checkbox',
      title: '',
      width: 50,
    },
    {
      field: 'index',
      title: '序号',
      width: 60,
    },
    {
      field: 'keyword',
      title: '搜索词',
      width: 110,
    },
    {
      field: 'detailUrl',
      title: '来源 URL',
      width: 160,
      visible: false,
    },
    {
      field: 'title',
      title: '标题',
      minWidth: 260,
      sortable: true,
      slots: {
        default: 'display_id'
      },
    },
    {
      field: 'color',
      title: '颜色',
      minWidth: 260,
      slots: {
        default: 'color'
      },
      exportMethod({ row }) {
        const colorList = row.data.skus.map((sku: any) => sku?.specs?.[0]?.spec_value)
        return [...new Set(colorList)].join('、')
      }
    },
    {
      field: 'size',
      title: '尺码',
      minWidth: 260,
      slots: {
        default: 'size'
      },
      exportMethod({ row }) {
        const sizeList = row.data.skus.map((sku: any) => sku?.specs?.[1]?.spec_value)
        return [...new Set(sizeList)].join(' ')
      }
    },
    {
      field: 'presale',
      title: '是否预售',
      width: 110,
      slots: {
        default: 'presale'
      },
      filters: [
        { label: '过滤预售', value: true }
      ],
      filterMethod(options) {
        const { row, option } = options
        if (option.label === '过滤预售' && row.title.includes('预售')) {
          return true
        }
        return false
      }
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 220,
      slots: {
        default: 'remark'
      },
      filters: [
        { label: '过滤无货', value: true },
        { label: '过滤快要抢光', value: true },
        { label: '过滤快要卖完', value: true },
      ],
      filterMethod(options) {
        const { row, option } = options
        const skuListString = JSON.stringify(row.data.skus)
        if (option.label === '过滤无货' && skuListString.includes(`"quantity":0`)) {
          return true
        }
        if (option.label === '过滤快要抢光' && skuListString.includes('快要抢光')) {
          return true
        }
        if (option.label === '过滤快要卖完' && skuListString.includes('快要卖完')) {
          return true
        }
        return false
      }
    },
    {
      field: 'created_time',
      title: '创建时间',
      width: 120,
      visible: false,
      sortable: true,
      formatter: ({ cellValue }) => formatTimeField(cellValue),
    },
    {
      field: 'updated_time',
      title: '更新时间',
      visible: false,
      sortable: true,
      width: 120,
      formatter: ({ cellValue }) => formatTimeField(cellValue),
    },
  ];
}
