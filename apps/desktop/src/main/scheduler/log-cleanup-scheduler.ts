import { AppDataSource } from '@/orm/data-source';
import { DaidaiLog } from '@/orm/entities/daidai-log';

/**
 * 清理一周前的日志
 */
export async function cleanupOldLogs(): Promise<void> {
  try {
    // 确保数据源已初始化
    if (!AppDataSource.isInitialized) {
      console.log('数据源未初始化，跳过日志清理');
      return;
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await AppDataSource.getRepository(DaidaiLog)
      .createQueryBuilder()
      .delete()
      .where('createdAt < :date', { date: oneWeekAgo })
      .execute();

    if (result.affected && result.affected > 0) {
      console.log(`清理了 ${result.affected} 条一周前的日志`);
    }
  } catch (error) {
    console.error('清理旧日志时出错:', error);
  }
}

/**
 * 日志清理定时任务管理器
 */
export class LogCleanupScheduler {
  private static instance: LogCleanupScheduler;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly INTERVAL_HOURS = 6; // 每6小时清理一次

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): LogCleanupScheduler {
    if (!LogCleanupScheduler.instance) {
      LogCleanupScheduler.instance = new LogCleanupScheduler();
    }
    return LogCleanupScheduler.instance;
  }

  /**
   * 启动定时清理任务
   */
  async startScheduledCleanup(): Promise<void> {
    if (this.cleanupInterval) {
      console.log('日志清理定时任务已在运行中');
      return;
    }

    // 等待数据源初始化完成
    if (!AppDataSource.isInitialized) {
      console.log('等待数据源初始化完成...');
      try {
        await AppDataSource.initialize();
        console.log('数据源初始化完成');
      } catch (error) {
        console.error('数据源初始化失败:', error);
        return;
      }
    }

    // 立即执行一次清理
    await cleanupOldLogs();

    // 设置定时任务，每6小时执行一次
    this.cleanupInterval = setInterval(() => {
      cleanupOldLogs();
    }, this.INTERVAL_HOURS * 60 * 60 * 1000);

    console.log(`日志清理定时任务已启动，每${this.INTERVAL_HOURS}小时清理一次`);
  }

  /**
   * 停止定时清理任务
   */
  stopScheduledCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('日志清理定时任务已停止');
    }
  }

  /**
   * 重启定时清理任务
   */
  async restartScheduledCleanup(): Promise<void> {
    this.stopScheduledCleanup();
    await this.startScheduledCleanup();
  }
}

/**
 * 启动日志清理定时任务
 */
export function startScheduledCleanup(): void {
  const scheduler = LogCleanupScheduler.getInstance();
  scheduler.startScheduledCleanup();
}

/**
 * 停止日志清理定时任务
 */
export function stopScheduledCleanup(): void {
  const scheduler = LogCleanupScheduler.getInstance();
  scheduler.stopScheduledCleanup();
}
