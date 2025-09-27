<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { computed, ref, watch } from 'vue';

import { useAuthStore } from '#/store';
import { isElectron } from '#/utils/constant';
import LoginForm from '#/views/_core/authentication/login.vue';

import { Button as AButton, Space as ASpace } from 'ant-design-vue';

const displayWindow = ref(false);

async function doDisplayWindow() {
  // await __API__.isShow() ? __API__.hideWindow() : __API__.showWindow();
  // displayWindow.value = await __API__.isShow();
  __API__.close()
}

setInterval(async () => {
  displayWindow.value = await __API__.isShow()
}, 500)
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
        <ASpace direction="vertical">
          <!-- <AButton @click="() => loadURL('about:blank')" v-show="displayWindow" style="width: 70px;">
            首页
          </AButton>
          <AButton @click="() => loadURL('https://play.daidaimeta.com/index/main')" v-show="displayWindow"
            style="width: 70px; color: #351c87;">
            带带
          </AButton> -->
          <AButton @click="doDisplayWindow" :type="displayWindow ? 'primary' : 'text'">
            <!-- {{ displayWindow ? '隐 藏' : '浏览器' }} -->
            {{ displayWindow ? '关 闭' : '' }}
          </AButton>
        </ASpace>
      </div>
    </template>
  </BasicLayout>
</template>
