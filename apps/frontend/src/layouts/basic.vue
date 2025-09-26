<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { AuthenticationLoginExpiredModal, useVbenModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { computed, provide, ref, watch } from 'vue';

import AccountSessoinViewer from '#/components/AccountSessoinViewer.vue';
import { useAuthStore } from '#/store';
import { isElectron } from '#/utils/constant';
import LoginForm from '#/views/_core/authentication/login.vue';

import ImageViewer from '#/components/ImageViewer.vue';
import VideoViewer from '#/components/VideoViewer.vue';
import { Button as AButton, Space as ASpace } from 'ant-design-vue';

const displayWindow = ref(false);
const showAccountSessionViewer = ref(false);
const accountSessionModelType = ref('');
const accountSessionViewerRef = ref()
const displayExportImages = ref(false);
const showImageViewer = ref(false);
const currentExportImagesOptions = ref<Record<any, any>>({})
const imageViewerRef = ref()

// 视频导出相关
const displayExportVideos = ref(false);
const showVideoViewer = ref(false);
const currentExportVideosOptions = ref<Record<any, any>>({})
const videoViewerRef = ref()

// 提供一个方法来处理浏览器打开
const handleBrowserOpen = (row: any) => {
  location.reload()
}

provide('handleBrowserOpen', handleBrowserOpen)

const [downloadImagesModal, downloadImagesModalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '导出选中图片',
  async onConfirm() {
    if (imageViewerRef.value) {
      const result = await imageViewerRef.value.exportZip()
      if (result) {
        downloadImagesModalApi.close()
      }
    }
  },
  onOpened() {
    displayWindow.value = false
    __API__.hideWindow()
  },
  onClosed: () => {
    showImageViewer.value = false;
    displayWindow.value = true
    __API__.showWindow()
  },
});

const [downloadVideosModal, downloadVideosModalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '下载选中视频',
  async onConfirm() {
    if (videoViewerRef.value) {
      const result = await videoViewerRef.value.downloadSelectedVideos()
      if (result) {
        downloadVideosModalApi.close()
      }
    }
  },
  onOpened() {
    displayWindow.value = false
    __API__.hideWindow()
  },
  onClosed: () => {
    showVideoViewer.value = false;
    displayWindow.value = true
    __API__.showWindow()
  },
});

const [accountSessionModel, accountSessionModelModalApi] = useVbenModal({
  showCancelButton: false,
  confirmText: '关闭窗口',
  async onConfirm() {
    accountSessionModelModalApi.close()
  },
  onOpenChange(isOpen) {
    displayWindow.value = !isOpen
    __API__.hideWindow()
  },
  onClosed: () => {
    showAccountSessionViewer.value = false;
    displayWindow.value = true
    __API__.showWindow()
  },
});

async function doDisplayWindow() {
  await __API__.isShow() ? __API__.hideWindow() : __API__.showWindow();
  displayWindow.value = await __API__.isShow();
}

setInterval(async () => {
  displayWindow.value = await __API__.isShow()
  refreshExportResourceButton()
}, 500)

async function refreshExportResourceButton() {
  displayExportImages.value = false
  displayExportVideos.value = false
  const browserUrl = await __API__.getURL()
  if (!browserUrl) return
  if (typeof browserUrl === 'string' && displayWindow.value) {
    const urls = new URL(browserUrl)
    if (
      // urls.href.startsWith('https://detail.tmall.com/item.htm') ||
      // urls.href.startsWith('https://item.taobao.com/item.htm') ||
      (urls.href.startsWith('https://detail.1688.com/offer/') && urls.pathname.endsWith('.html')) ||
      ((urls.href.startsWith('https://mobile.yangkeduo.com') || urls.href.startsWith('https://mobile.pinduoduio.com')) && urls.pathname.startsWith('/goods.html'))
    ) {
      displayExportImages.value = true
      displayExportVideos.value = true
    }
  }
}

function loadURL(url: string, accountType?: string) {
  if (!accountType) {
    __API__.reopenBrowser({
      url: url,
      type: 'pdd',
    })
    return
  }
  accountSessionModelType.value = accountType
  accountSessionModelModalApi.open()
  showAccountSessionViewer.value = true
}

// 控制资源导出分支
async function exportMediaResrouce(type: 'video' | 'image', currentUrl?: string, _productId?: string) {
  currentExportVideosOptions.value = {}
  currentExportImagesOptions.value = {}
  const browserUrl = currentUrl || await __API__.getURL()
  console.log(`🚀 ~ exportMediaResrouce ~ browserUrl:`, browserUrl)
  if (!browserUrl) return browserUrl
  const urls = new URL(browserUrl)
  if (browserUrl.startsWith('https://detail.tmall.com/item.htm') ||
    browserUrl.startsWith('https://item.taobao.com/item.htm')) {
    const productId = _productId || new URL(browserUrl).searchParams.get('id')
    if (!productId) return
    const product = await __API__.getOneList(productId.toString())
    console.log(`🚀 ~ exportMediaResrouce ~ product:`, product)
    if (!product) return
    if (type === 'image') exportTaobaoTmallImages(product)
    if (type === 'video') exportTaobaoTmallVideos(product)
  }
  if (urls.href.startsWith('https://detail.1688.com/offer/') && urls.pathname.endsWith('.html')) {
    const productId = _productId || urls.pathname.replace('.html', '').replace('/offer/', '')
    const product = await __API__.getOneList(productId.toString())
    if (!product) return
    if (type === 'image') export1688Images(product)
    if (type === 'video') export1688Videos(product)
  }
  if (urls.href.startsWith('https://mobile.yangkeduo.com') || urls.href.startsWith('https://mobile.pinduoduio.com')) {
    if (urls.pathname.startsWith('/goods.html')) {
      const productId = _productId || `pdd-${new URL(browserUrl).searchParams.get('goods_id')}`
      const product = await __API__.getOneList(productId.toString())
      if (!product) return
      if (type === 'image') exportPddImages(product)
      if (type === 'video') exportPddVideos(product)
    }
  }
}
window.exportMediaResrouce = exportMediaResrouce

// 图片导出
async function exportTaobaoTmallImages(product: any) {
  downloadImagesModalApi.open()
  showImageViewer.value = true;
  const selecterRecord = product.data
  currentExportImagesOptions.value = {
    fileName: selecterRecord.title,
    images: [
      {
        name: '主图',
        urls: Array.from(selecterRecord.data?.mainImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: '详情图',
        urls: Array.from(selecterRecord.data?.descImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: 'SKU图',
        urls: Array.from(selecterRecord.data?.skuImages || []).map((item: any) => {
          item.src = String(item.src).replaceAll('90x90q30.jpg_', '')
          return item
        }) || []
      }
    ]
  }
}

async function export1688Images(product: any) {
  downloadImagesModalApi.open()
  showImageViewer.value = true;
  const selecterRecord = product.data
  currentExportImagesOptions.value = {
    fileName: selecterRecord.title,
    images: [
      {
        name: '主图',
        urls: Array.from(selecterRecord.data?.mainImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: '详情图',
        urls: Array.from(selecterRecord.data?.descImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: 'SKU图',
        urls: selecterRecord.data?.skuImages || []
      }
    ]
  }
}

async function exportPddImages(product: any) {
  downloadImagesModalApi.open()
  showImageViewer.value = true;
  const selecterRecord = product.data
  currentExportImagesOptions.value = {
    fileName: selecterRecord.title,
    images: [
      {
        name: '主图',
        urls: Array.from(selecterRecord.data?.mainImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: '详情图',
        urls: Array.from(selecterRecord.data?.descImages || []).map(url => ({ src: url, name: '' }))
      },
      {
        name: 'SKU图',
        urls: selecterRecord.data?.skuImages || []
      }
    ]
  }
}

// 视频导出
async function exportTaobaoTmallVideos(product: any) {
  downloadVideosModalApi.open()
  showVideoViewer.value = true;
  const selecterRecord = product.data
  console.log(`🚀 ~ exportTaobaoTmallVideos ~ selecterRecord.data?.videos:`, selecterRecord.data?.videos)
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
}

async function export1688Videos(product: any) {
  downloadVideosModalApi.open()
  showVideoViewer.value = true;
  const selecterRecord = product.data
  currentExportVideosOptions.value = {
    fileName: selecterRecord.title,
    videos: [
      {
        name: '产品视频',
        urls: Array.from(selecterRecord.data?.videos || []).map((video: any, index: number) => ({
          src: video.videoUrl,
          name: video.title || `${selecterRecord.title}-${index + 1}` || ''
        }))
      }
    ]
  }
}

async function exportPddVideos(product: any) {
  downloadVideosModalApi.open()
  showVideoViewer.value = true;
  const selecterRecord = product.data
  currentExportVideosOptions.value = {
    fileName: selecterRecord.title,
    videos: [
      {
        name: '产品视频',
        urls: Array.from(selecterRecord.data?.videos || []).map((video: any, index: number) => ({
          src: video.url,
          name: video.title || `${selecterRecord.title}-${index + 1}` || ''
        }))
      }
    ]
  }
}
// ---------------------------------- //
const notifications = ref<NotificationItem[]>([]);
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);

const menus = computed(() => [
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

function handleNoticeClear() {
  notifications.value = [];
}

function handleMakeAll() {
  notifications.value.forEach((item) => (item.isRead = true));
}

watch(
  () => preferences.app.watermark,
  async (enable) => {
    if (enable) {
      await updateWatermark({
        content: `${userStore.userInfo?.username}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown v-if="!isElectron">
      <UserDropdown :avatar :menus :text="userStore.userInfo?.username" description="" tag-text="Pro"
        @logout="handleLogout" />
    </template>
    <template #notification>
      <Notification :dot="showDot" :notifications="notifications" @clear="handleNoticeClear"
        @make-all="handleMakeAll" />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal v-model:open="accessStore.loginExpired" :avatar>
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
    <!-- <template #aside-header>
      <div class="text-center h-[20px]">2222222222222</div>
    </template> -->
    <template #aside-header>
      <!-- <div class="flex flex-col justify-center items-center h-[80px]">
        <UserDropdown :avatar :menus :text="userStore.userInfo?.username" description="" tag-text="Pro" side="right"
          @logout="handleLogout" />
      </div> -->
    </template>
    <template #aside-footer>
      <div class="flex flex-col justify-center items-center mb-[10px]">
        <ASpace direction="vertical" class="mb-[50px]">
          <AButton @click="() => exportMediaResrouce('image')" v-show="displayExportImages"
            style="width: 75px; font-size: 0.70rem;">
            导出图片
          </AButton>
          <AButton @click="() => exportMediaResrouce('video')" v-show="displayExportVideos"
            style="width: 75px; font-size: 0.70rem;">
            导出视频
          </AButton>
        </ASpace>
        <ASpace direction="vertical">
          <AButton @click="() => loadURL('about:blank')" v-show="displayWindow" style="width: 70px;">
            首页
          </AButton>
          <AButton @click="() => loadURL('https://www.taobao.com')" v-show="displayWindow"
            style="width: 70px; color: #ff5502;">
            淘宝
          </AButton>
          <AButton @click="() => loadURL('https://www.tmall.com')" v-show="displayWindow"
            style="width: 70px; color: #e4393c;">
            天猫
          </AButton>
          <AButton @click="() => loadURL('https://www.1688.com')" v-show="displayWindow"
            style="width: 70px; color: #ff5502;">
            1688
          </AButton>
          <AButton @click="() => loadURL('https://mobile.yangkeduo.com', 'pdd')" v-show="displayWindow"
            style="width: 70px; color: #e62829;">
            多多
          </AButton>
          <AButton @click="doDisplayWindow" :type="displayWindow ? 'primary' : 'text'">
            {{ displayWindow ? '隐 藏' : '选 品' }}
          </AButton>
        </ASpace>
        <accountSessionModel class="w-[80%]" title="账号管理">
          <AccountSessoinViewer v-if="showAccountSessionViewer" ref="accountSessionViewerRef"
            :default-url="'https://mobile.yangkeduo.com'" :type="accountSessionModelType" style="z-index: 999999999;" />
        </accountSessionModel>
        <downloadImagesModal class="w-[80%]" :title="`图片导出 - ${currentExportImagesOptions.fileName || ''}`">
          <ImageViewer v-if="showImageViewer" ref="imageViewerRef" :options="currentExportImagesOptions"
            style="z-index: 999999999;" />
        </downloadImagesModal>
        <downloadVideosModal class="w-[80%]" :title="`视频导出 - ${currentExportVideosOptions.fileName || ''}`">
          <VideoViewer v-if="showVideoViewer" ref="videoViewerRef" :options="currentExportVideosOptions"
            style="z-index: 999999999;" />
        </downloadVideosModal>
      </div>
    </template>
  </BasicLayout>
</template>
