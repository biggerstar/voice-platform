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
      field: 'id',
      title: 'ID',
      width: 80,
      visible: false,
    },
    {
      field: 'accountSessionId',
      title: '所属账号',
      width: 180,
      sortable: true,
    },
    {
      field: 'roomId',
      title: '房间ID',
      width: 120,
      sortable: true,
    },
    {
      field: 'message',
      title: '监控状态',
      minWidth: 300,
      showOverflow: 'tooltip',
      slots: {
        default: 'remark'
      },
    },
    // {
    //   field: 'createdAt',
    //   title: '创建时间',
    //   width: 160,
    //   sortable: true,
    //   formatter: ({ cellValue }) => {
    //     if (!cellValue) return '';
    //     try {
    //       return dayjs(cellValue).format('YYYY-MM-DD HH:mm:ss');
    //     } catch (error) {
    //       return cellValue || '';
    //     }
    //   },
    // },
    // {
    //   field: 'updatedAt',
    //   title: '更新时间',
    //   width: 160,
    //   sortable: true,
    //   formatter: ({ cellValue }) => {
    //     if (!cellValue) return '';
    //     try {
    //       return dayjs(cellValue).format('YYYY-MM-DD HH:mm:ss');
    //     } catch (error) {
    //       return cellValue || '';
    //     }
    //   },
    // },
  ];
}
