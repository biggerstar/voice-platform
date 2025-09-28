import { app } from 'electron';
import { LogCleanupScheduler } from './log-cleanup-scheduler';
import { LeaderboardScheduler } from './leaderboard-scheduler';

/**
 * 定时任务管理器
 * 所有定时任务的启动和管理都集中在这里
 */
class SchedulerManager {
  private static instance: SchedulerManager;
  private logCleanupScheduler: LogCleanupScheduler;
  private leaderboardScheduler: LeaderboardScheduler;
  private isInitialized = false;

  private constructor() {
    this.logCleanupScheduler = LogCleanupScheduler.getInstance();
    this.leaderboardScheduler = LeaderboardScheduler.getInstance();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SchedulerManager {
    if (!SchedulerManager.instance) {
      SchedulerManager.instance = new SchedulerManager();
    }
    return SchedulerManager.instance;
  }

  /**
   * 初始化所有定时任务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('定时任务管理器已经初始化');
      return;
    }

    try {
      // 启动日志清理定时任务
      await this.logCleanupScheduler.startScheduledCleanup();

      // 启动榜单定时任务
      await this.leaderboardScheduler.startScheduledTask();

      // 监听应用退出事件，确保定时任务优雅关闭
      app.on('will-quit', () => {
        this.shutdown();
      });

      this.isInitialized = true;
      console.log('定时任务管理器初始化完成');
    } catch (error) {
      console.error('定时任务管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 关闭所有定时任务
   */
  private shutdown(): void {
    console.log('正在关闭所有定时任务...');
    this.logCleanupScheduler.stopScheduledCleanup();
    this.leaderboardScheduler.stopScheduledTask();
    console.log('所有定时任务已关闭');
  }

  /**
   * 重启所有定时任务
   */
  async restartAll(): Promise<void> {
    this.shutdown();
    await this.initialize();
  }
}

/**
 * 初始化定时任务管理器
 * 这是唯一的入口点，所有定时任务都在这里启动
 */
export async function initializeSchedulers(): Promise<void> {
  const manager = SchedulerManager.getInstance();
  await manager.initialize();
}

/**
 * 重启所有定时任务
 */
export async function restartAllSchedulers(): Promise<void> {
  const manager = SchedulerManager.getInstance();
  await manager.restartAll();
}
