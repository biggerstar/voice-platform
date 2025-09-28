import { AppDataSource } from '@/orm/data-source';
import { AccountSessionEntity } from '@/orm/entities/account-session';
import { checkSessionInUse, fetchRoomLeaderboardData, getMirrorTaskStatus } from '../ipc/ipc-daidai';
import { sendWeixinWebhookMarkdown } from '../webhook/weixin';

/**
 * 获取排名对应的 emoji
 */
function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';

  // 第四名开始使用圆圈数字符号
  const circleNumbers = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];

  if (rank <= 20) {
    return ` ${circleNumbers[rank]} `;
  } else {
    return '㉑';
  }
}

/**
 * 格式化榜单数据为 Markdown 格式
 */
function formatLeaderboardToMarkdown(meiliTopInfo: any[], wealthTopInfo: any[], roomName?: string): string {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  let markdown = `# \t\t\t ${roomName || '房间'} \t\t\t \n\n`;
  markdown += `   \n`;
  // 魅力榜
  if (meiliTopInfo && meiliTopInfo.length > 0) {
    markdown += `##  魅力榜 💎 \n\n`;
    meiliTopInfo.forEach((item, index) => {
      const rank = index + 1;
      const emoji = getRankEmoji(rank);
      const nickname = item.nickname || item.name;
      if (nickname) {
        markdown += `> ${emoji}  ${item.uid} - ${nickname} \n`;
      }
    });
  }
  markdown += ` \n\n`;

  // 财富榜
  if (wealthTopInfo && wealthTopInfo.length > 0) {
    markdown += `##  财富榜 💰 \n\n`;
    wealthTopInfo.forEach((item, index) => {
      const rank = index + 1;
      const emoji = getRankEmoji(rank);
      const nickname = item.nickname || item.name;
      if (nickname) {
        markdown += `> ${emoji}  ${item.uid} - ${nickname} \n`;
      }
    });
  }
  markdown += ` \n\n`;
  markdown += `**更新时间**: ${timeStr}\n\n`;

  return markdown;
}

/**
 * 房间任务接口
 */
interface RoomTask {
  sessionId: string;
  roomId: string;
  webhookKey: string;
  sessionName?: string;
}

/**
 * 获取单个房间的榜单数据并发送到 webhook
 */
async function fetchAndSendSingleRoomData(task: RoomTask): Promise<void> {
  try {
    // 检查会话是否仍在使用中 - 使用会话名称而不是数据库ID来生成 viewId
    const viewId = `daidai_${task.sessionName}`;
    if (!checkSessionInUse(viewId)) {
      console.log(`⚠️ [leaderboard-scheduler] 会话 ${task.sessionId} (${task.sessionName}) 未在使用中，跳过房间 ${task.roomId}`);
      return;
    }

    // 获取榜单数据 - 直接调用导出的函数
    let leaderboardData;

    try {
      const fetchParams = {
        sessionId: task.sessionName, // 使用会话名称而不是数据库ID
        roomId: task.roomId
      };
      leaderboardData = await fetchRoomLeaderboardData(fetchParams);
    } catch (error) {
      console.error(`❌ [leaderboard-scheduler] 调用榜单数据获取失败:`, error);
      leaderboardData = { success: false, error: '调用榜单数据获取失败' };
    }

    if (!leaderboardData.success) {
      console.error(`❌ [leaderboard-scheduler] 获取房间 ${task.roomId} 榜单数据失败:`, leaderboardData.error);
      return;
    }

    // 格式化并发送数据
    const { meiliTopInfo = [], wealthTopInfo = [] } = leaderboardData.data || {};
    if (meiliTopInfo.length || wealthTopInfo.length) {
      const markdownContent = formatLeaderboardToMarkdown(meiliTopInfo, wealthTopInfo, `房间 ${task.roomId}`);
      console.info(`发送榜单 markdown 数据:\n ${markdownContent}`)
      try {
        await sendWeixinWebhookMarkdown({ key: task.webhookKey, content: markdownContent });
        console.log(`✅ [leaderboard-scheduler] 房间 ${task.roomId} 榜单数据发送成功`);
      } catch (error) {
        console.error(`❌ [leaderboard-scheduler] 房间 ${task.roomId} 榜单数据发送失败:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ [leaderboard-scheduler] 处理房间 ${task.roomId} 榜单数据时出错:`, error);
  }
}

/**
 * 收集所有需要处理的房间任务
 */
async function collectAllRoomTasks(): Promise<RoomTask[]> {
  try {
    const accountSessionRepository = AppDataSource.getRepository(AccountSessionEntity);
    // 获取所有配置了榜单机器人且启用的会话
    const sessions = await accountSessionRepository
      .createQueryBuilder('session')
      .where('session.leaderboard_webhook_url IS NOT NULL')
      .andWhere('session.leaderboard_webhook_url != :empty', { empty: '' })
      .andWhere('session.enabled = :enabled', { enabled: true })
      .getMany();

    const roomTasks: RoomTask[] = [];

    for (const session of sessions) {
      // 检查会话是否正在使用中 - 使用会话名称而不是ID来生成 viewId
      const viewId = `daidai_${session.name}`;
      if (!checkSessionInUse(viewId)) {
        continue;
      }

      const urlMatch = session.leaderboard_webhook_url!.match(/key=([^&]+)/);
      if (!urlMatch) {
        console.error(`❌ [leaderboard-scheduler] 会话 ${session.name} 的 webhook URL 格式无效: ${session.leaderboard_webhook_url}`);
        continue;
      }

      const webhookKey = urlMatch[1];
      const rooms = session.data?.rooms || [];

      if (rooms.length === 0) {
        console.log(`⚠️ [leaderboard-scheduler] 会话 ${session.id} (${session.name}) 没有房间数据，跳过`);
        continue;
      }

      // 为每个房间创建任务
      for (const roomId of rooms) {
        roomTasks.push({
          sessionId: session.id,        // 这里存储的是数据库ID（如 "1"）
          roomId: roomId.toString(),
          webhookKey,
          sessionName: session.name     // 这里存储的是会话名称（如 "ddd"）
        });
      }

      console.log(`📋 [leaderboard-scheduler] 会话 ${session.id} (${session.name}) 添加了 ${rooms.length} 个房间任务`);
    }

    return roomTasks;
  } catch (error) {
    console.error('❌ [leaderboard-scheduler] 收集房间任务失败:', error);
    return [];
  }
}

/**
 * 检查是否有任何监控任务在运行
 */
function hasActiveMonitoring(): boolean {
  try {
    const status = getMirrorTaskStatus();
    return status.isRunning && status.activeCount > 0;
  } catch (error) {
    console.error('❌ [leaderboard-scheduler] 检查监控状态失败:', error);
    return false;
  }
}

/**
 * 榜单定时任务管理器
 */
export class LeaderboardScheduler {
  private static instance: LeaderboardScheduler;
  private monitoringCheckInterval: NodeJS.Timeout | null = null;
  private leaderboardTaskInterval: NodeJS.Timeout | null = null;
  private currentRoomIndex = 0;
  private roomTasks: RoomTask[] = [];
  private isTaskRunning = false;

  private constructor() { }

  /**
   * 获取单例实例
   */
  static getInstance(): LeaderboardScheduler {
    if (!LeaderboardScheduler.instance) {
      LeaderboardScheduler.instance = new LeaderboardScheduler();
    }
    return LeaderboardScheduler.instance;
  }

  /**
   * 启动榜单定时任务
   */
  async startScheduledTask(): Promise<void> {
    if (this.monitoringCheckInterval) {
      console.log('📊 [leaderboard-scheduler] 榜单定时任务已在运行中');
      return;
    }

    // 等待数据源初始化完成
    if (!AppDataSource.isInitialized) {
      console.log('⏳ [leaderboard-scheduler] 等待数据源初始化完成...');
      try {
        await AppDataSource.initialize();
        console.log('✅ [leaderboard-scheduler] 数据源初始化完成');
      } catch (error) {
        console.error('❌ [leaderboard-scheduler] 数据源初始化失败:', error);
        return;
      }
    }

    // 每10秒检查一次监控状态
    this.monitoringCheckInterval = setInterval(() => {
      this.checkAndManageLeaderboardTask();
    }, 10 * 1000);

    console.log('🎯 [leaderboard-scheduler] 榜单调度器已启动，每10秒检查监控状态');
  }

  /**
   * 检查监控状态并管理榜单任务
   */
  private async checkAndManageLeaderboardTask(): Promise<void> {
    try {
      const hasMonitoring = hasActiveMonitoring();

      if (hasMonitoring && !this.leaderboardTaskInterval) {
        // 开启监控，启动榜单任务
        await this.startLeaderboardTask();
      } else if (!hasMonitoring && this.leaderboardTaskInterval) {
        // 关闭监控，停止榜单任务
        this.stopLeaderboardTask();
      }
    } catch (error) {
      console.error('❌ [leaderboard-scheduler] 检查监控状态时出错:', error);
    }
  }

  /**
   * 启动榜单任务
   */
  private async startLeaderboardTask(): Promise<void> {
    if (this.leaderboardTaskInterval) {
      return;
    }

    console.log('🚀 [leaderboard-scheduler] 检测到监控开启，启动榜单任务');

    // 初始化房间任务列表
    await this.refreshRoomTasks();

    // 每分钟执行一次榜单任务
    this.leaderboardTaskInterval = setInterval(async () => {
      await this.executeNextRoomTask();
    }, 60 * 1000);

    console.log('✅ [leaderboard-scheduler] 榜单任务已启动，每分钟顺序处理一个房间');
  }

  /**
   * 停止榜单任务
   */
  private stopLeaderboardTask(): void {
    if (this.leaderboardTaskInterval) {
      clearInterval(this.leaderboardTaskInterval);
      this.leaderboardTaskInterval = null;
      this.currentRoomIndex = 0;
      this.roomTasks = [];
      console.log('🛑 [leaderboard-scheduler] 检测到监控关闭，榜单任务已停止');
    }
  }

  /**
   * 刷新房间任务列表
   */
  private async refreshRoomTasks(): Promise<void> {
    try {
      this.roomTasks = await collectAllRoomTasks();
      this.currentRoomIndex = 0;
      console.log(`📋 [leaderboard-scheduler] 刷新房间任务列表，共 ${this.roomTasks.length} 个房间`);
    } catch (error) {
      console.error('❌ [leaderboard-scheduler] 刷新房间任务列表失败:', error);
      this.roomTasks = [];
    }
  }

  /**
   * 执行下一个房间任务
   */
  private async executeNextRoomTask(): Promise<void> {
    if (this.isTaskRunning) {
      console.log('⚠️ [leaderboard-scheduler] 上一个任务仍在执行中，跳过本次执行');
      return;
    }

    this.isTaskRunning = true;

    try {
      // 如果房间列表为空，重新获取房间列表
      if (this.roomTasks.length === 0) {
        await this.refreshRoomTasks();

        if (this.roomTasks.length === 0) {
          console.log('📝 [leaderboard-scheduler] 没有需要处理的房间任务');
          return;
        }
      }

      // 如果已处理完所有房间，重置索引以实现循环发送
      if (this.currentRoomIndex >= this.roomTasks.length) {
        console.log('🔄 [leaderboard-scheduler] 已完成一轮发送，重新开始循环');
        this.currentRoomIndex = 0;
        // 可选：重新获取房间列表以获取最新的配置
        await this.refreshRoomTasks();

        if (this.roomTasks.length === 0) {
          console.log('📝 [leaderboard-scheduler] 没有需要处理的房间任务');
          return;
        }
      }

      // 获取当前要处理的房间任务
      const currentTask = this.roomTasks[this.currentRoomIndex];
      console.log(`📤 [leaderboard-scheduler] 处理房间任务 ${this.currentRoomIndex + 1}/${this.roomTasks.length}: 房间 ${currentTask.roomId} (会话: ${currentTask.sessionName || currentTask.sessionId})`);

      // 执行房间任务
      await fetchAndSendSingleRoomData(currentTask);

      // 移动到下一个房间
      this.currentRoomIndex++;

    } catch (error) {
      console.error('❌ [leaderboard-scheduler] 执行房间任务时出错:', error);
    } finally {
      this.isTaskRunning = false;
    }
  }

  /**
   * 停止榜单定时任务
   */
  stopScheduledTask(): void {
    if (this.monitoringCheckInterval) {
      clearInterval(this.monitoringCheckInterval);
      this.monitoringCheckInterval = null;
    }

    this.stopLeaderboardTask();
    console.log('🛑 [leaderboard-scheduler] 榜单调度器已完全停止');
  }

  /**
   * 重启榜单定时任务
   */
  async restartScheduledTask(): Promise<void> {
    console.log('🔄 [leaderboard-scheduler] 重启榜单调度器');
    this.stopScheduledTask();
    await this.startScheduledTask();
  }

  /**
   * 手动执行一次榜单任务
   */
  async executeOnce(): Promise<void> {
    console.log('🎯 [leaderboard-scheduler] 手动执行榜单任务');
    await this.executeNextRoomTask();
  }
}

/**
 * 启动榜单定时任务（便捷函数）
 */
export function startLeaderboardScheduler(): void {
  LeaderboardScheduler.getInstance().startScheduledTask();
}

/**
 * 停止榜单定时任务（便捷函数）
 */
export function stopLeaderboardScheduler(): void {
  LeaderboardScheduler.getInstance().stopScheduledTask();
}
