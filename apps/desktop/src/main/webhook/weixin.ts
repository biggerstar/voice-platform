import { AccountSessionEntity } from "@/orm/entities/account-session";

export async function sendWeixinWebhookText(params: { key: string; content: string }) {
  const { key, content } = params
  const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      msgtype: 'text',
      text: {
        content,
      },
    }),
  })
  const json = await response.json()
  console.info(`🚀 ~ sendWeixinWebhookText ~ response:`, json)
}

export async function sendWeixinWebhookMarkdown(params: { key: string; content: string }) {
  const { key, content } = params
  const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        content,
      },
    }),
  })
  const json = await response.json()
  console.info(`🚀 ~ sendWeixinWebhookMarkdown ~ response:`, json)
}

/**
 * 根据 session ID 发送 webhook 消息
 * @param sessionId - 账号会话 ID
 * @param content - 消息内容
 * @param msgType - 消息类型，默认为 'text'
 * @returns 发送结果
 */
export async function sendWebhookBySession(params: {
  sessionId: string;
  content: string;
  msgType?: 'text' | 'markdown';
}): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    const { sessionId, content, msgType = 'text' } = params;

    // 根据 sessionId 查找账号会话，先按 ID 查找，如果找不到再按名称查找
    let accountSession = await AccountSessionEntity.findOne({
      where: { id: sessionId }
    });

    // 如果按 ID 找不到，尝试按名称查找
    if (!accountSession) {
      accountSession = await AccountSessionEntity.findOne({
        where: { name: sessionId }
      });
    }

    if (!accountSession) {
      const error = `账号会话不存在: ${sessionId}`;
      console.error(`❌ [sendWebhookBySession] ${error}`);
      return { success: false, error };
    }

    // 检查是否绑定了 webhook
    if (!accountSession.webhook_url) {
      const error = `账号会话 ${sessionId} 未绑定 webhook`;
      console.error(`❌ [sendWebhookBySession] ${error}`);
      return { success: false, error };
    }

    // 从 webhook_url 中提取 key
    const webhookUrl = accountSession.webhook_url;
    const keyMatch = webhookUrl.match(/key=([^&]+)/);
    if (!keyMatch) {
      const error = `无效的 webhook URL 格式: ${webhookUrl}`;
      console.error(`❌ [sendWebhookBySession] ${error}`);
      return { success: false, error };
    }

    const key = keyMatch[1];
    console.info(`📤 [sendWebhookBySession] 发送消息到 ${accountSession.webhook_bot || 'Unknown Bot'} (${sessionId})`);

    // 根据消息类型发送
    if (msgType === 'markdown') {
      await sendWeixinWebhookMarkdown({ key, content });
    } else {
      await sendWeixinWebhookText({ key, content });
    }

    console.info(`✅ [sendWebhookBySession] 消息发送成功 - sessionId: ${sessionId}, bot: ${accountSession.webhook_bot}`);
    return { success: true };

  } catch (error) {
    const errorMessage = `发送 webhook 消息失败: ${error.message}`;
    console.error(`❌ [sendWebhookBySession] ${errorMessage}`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 检查所有 session 是否都绑定了 webhook 和榜单机器人
 * @param sessionIds - 要检查的 session ID 列表
 * @returns 检查结果
 */
export async function validateSessionsWebhook(sessionIds: string[]): Promise<{
  success: boolean;
  unboundSessions: string[];
  unboundLeaderboardSessions: string[];
  message?: string;
}> {
  try {
    const unboundSessions: string[] = [];
    const unboundLeaderboardSessions: string[] = [];

    for (const sessionId of sessionIds) {
      // 先按 ID 查找，如果找不到再按名称查找
      let accountSession = await AccountSessionEntity.findOne({
        where: { id: sessionId }
      });

      // 如果按 ID 找不到，尝试按名称查找
      if (!accountSession) {
        accountSession = await AccountSessionEntity.findOne({
          where: { name: sessionId }
        });
      }

      if (!accountSession) {
        console.warn(`⚠️ [validateSessionsWebhook] 账号会话不存在: ${sessionId}`);
        unboundSessions.push(sessionId);
        unboundLeaderboardSessions.push(sessionId);
        continue;
      }

      // 检查普通机器人绑定
      if (!accountSession.webhook_url) {
        console.warn(`⚠️ [validateSessionsWebhook] 账号会话未绑定 webhook: ${sessionId} (${accountSession.name})`);
        unboundSessions.push(sessionId);
      }

      // 检查榜单机器人绑定
      if (!accountSession.leaderboard_webhook_url) {
        console.warn(`⚠️ [validateSessionsWebhook] 账号会话未绑定榜单机器人: ${sessionId} (${accountSession.name})`);
        unboundLeaderboardSessions.push(sessionId);
      }
    }

    // 构建错误消息
    const errorMessages: string[] = [];
    
    if (unboundSessions.length > 0) {
      errorMessages.push(`以下 session 未绑定普通机器人: ${unboundSessions.join(', ')}`);
    }
    
    if (unboundLeaderboardSessions.length > 0) {
      errorMessages.push(`以下 session 未绑定榜单机器人: ${unboundLeaderboardSessions.join(', ')}`);
    }

    if (errorMessages.length > 0) {
      const message = errorMessages.join('; ');
      console.error(`❌ [validateSessionsWebhook] ${message}`);
      return { 
        success: false, 
        unboundSessions, 
        unboundLeaderboardSessions,
        message 
      };
    }

    console.info(`✅ [validateSessionsWebhook] 所有 session 都已绑定 webhook 和榜单机器人`);
    return { 
      success: true, 
      unboundSessions: [], 
      unboundLeaderboardSessions: []
    };

  } catch (error) {
    const message = `检查 webhook 绑定失败: ${error.message}`;
    console.error(`❌ [validateSessionsWebhook] ${message}`, error);
    return { 
      success: false, 
      unboundSessions: [], 
      unboundLeaderboardSessions: [],
      message 
    };
  }
}
