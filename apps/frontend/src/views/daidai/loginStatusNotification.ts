import { notification } from 'ant-design-vue';
import { ref } from 'vue';

// 通知防重复逻辑
const notificationState = ref<Record<string, {
  lastNotificationTime: number
  hasLoggedInSince: boolean
}>>({})

// 检查并发送未登录通知
export function checkAndNotifyLoginStatus(accountList: any[]) {
  const now = Date.now()
  const tenMinutes =  10 * 1000 // 10分钟

  // console.log('🔍 检查登录状态，账号数量:', accountList.length)
  
  accountList.forEach(account => {
    const accountName = account.name
    const loginStatus = account.login_status
    
    // console.log(`📊 账号: ${accountName}, 状态: ${loginStatus}`)
    
    // 只有 '已登录' 状态被认为是正常的，其他所有状态都视为未登录
    if (loginStatus !== '已登录') {
      const state = notificationState.value[accountName]
      // console.log(`⚠️ 发现未登录账号: ${accountName}, 状态: ${loginStatus}, 当前通知状态:`, state)

      if (!state) {
        // 首次检测到未登录，初始化状态并发送通知
        notificationState.value[accountName] = {
          lastNotificationTime: now,
          hasLoggedInSince: false
        }
        console.log(`🚨 首次发现未登录，发送通知: ${accountName}`)
        sendLoginNotification(accountName)
      } else if (state.hasLoggedInSince && (now - state.lastNotificationTime) >= tenMinutes) {
        // 如果之前登录过且距离上次通知超过10分钟，发送新通知
        state.lastNotificationTime = now
        state.hasLoggedInSince = false
        console.log(`🔄 重新发送通知: ${accountName}`)
        sendLoginNotification(accountName)
      } else {
        // console.log(`⏳ 跳过通知: ${accountName}, 原因: 冷却期内或未重新登录`)
      }
    } else {
      // 检测到登录，重置通知权限
      if (notificationState.value[accountName]) {
        notificationState.value[accountName].hasLoggedInSince = true
        // console.log(`✅ 账号已登录，重置通知权限: ${accountName}`)
      }
    }
  })
}

// 发送登录通知
function sendLoginNotification(accountName: string) {
  // console.log(`📢 发送未登录通知: ${accountName}`)
  notification.warning({
    message: '账号登录状态异常',
    description: `账号 "${accountName}" 当前处于未登录状态，请检查登录情况。`,
    duration: 600, // 10分钟后自动关闭 (600秒)
    placement: 'bottomRight',
  })
}

// 清理通知状态（可选，用于重置所有状态）
export function clearNotificationState() {
  notificationState.value = {}
}

// 获取当前通知状态（用于调试）
export function getNotificationState() {
  return notificationState.value
}
