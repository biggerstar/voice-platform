import { AppDataSource } from "@/orm/data-source";
import { DaidaiLog } from "@/orm/entities/daidai-log";
import { UserDeduplication } from "@/orm/entities/user-deduplication";
import { ipcMain } from "electron";
import { LessThan, MoreThan } from "typeorm";

// 日志仓库
const daidaiLogRepository = AppDataSource.getRepository(DaidaiLog);
// 去重仓库
const userDeduplicationRepository = AppDataSource.getRepository(UserDeduplication);

// 去重时间窗口：10分钟
const duplicateTime = 60 * 1000 * 10;

// 添加日志
ipcMain.handle('update-daidai-log', async (_, id: string, status: string, message?: string, roomId?: string) => {
  console.info(`[update-daidai-log]`, 'id=', id, ' status=', status, ' message=', message, ' roomId', roomId)
  try {
    let log: DaidaiLog;

    // 如果提供了 roomId，先查找是否已存在该 roomId 的记录
    if (roomId) {
      const existingLog = await daidaiLogRepository.findOne({
        where: {
          accountSessionId: id,
          roomId: roomId
        }
      });

      if (existingLog) {
        // 如果存在，更新现有记录的 message 和 status
        existingLog.status = status;
        existingLog.message = message || '';
        existingLog.updatedAt = new Date();
        log = existingLog;
      } else {
        // 如果不存在，创建新记录
        log = new DaidaiLog();
        log.accountSessionId = id;
        log.status = status;
        log.message = message || '';
        log.roomId = roomId;
      }
    } else {
      // 如果没有 roomId，直接创建新记录
      log = new DaidaiLog();
      log.accountSessionId = id;
      log.status = status;
      log.message = message || '';
    }

    const result = await daidaiLogRepository.save(log);

    // 异步清理旧日志（不等待，避免影响响应速度）
    // 注意：清理逻辑现在在定时任务中管理，这里不再直接调用

    return { success: true, data: result };
  } catch (error) {
    console.error('更新日志失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取日志列表
ipcMain.handle('get-daidai-logs', async (_, options = {}) => {
  try {
    const { accountSessionId, skip = 0, take = 50 } = options;

    const query = daidaiLogRepository.createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (accountSessionId) {
      query.where('log.accountSessionId = :accountSessionId', { accountSessionId });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      success: true,
      data: {
        data,
        total,
        pageSize: take,
        current: Math.floor(skip / take) + 1
      }
    };
  } catch (error) {
    console.error('获取日志列表失败:', error);
    return { success: false, error: error.message };
  }
});

// 删除日志
ipcMain.handle('delete-daidai-logs', async (_, ids = []) => {
  try {
    if (!ids.length) return { success: false, error: '未指定要删除的日志ID' };

    await daidaiLogRepository.delete(ids);
    return { success: true };
  } catch (error) {
    console.error('删除日志失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-mirror-task', () => {
  console.info(`🚀 ~ start-mirror-task:`)
})

ipcMain.handle('stop-mirror-task', () => {
  console.info(`🚀 ~ stop-mirror-task:`)
})

// 处理 DaiDai 事件上报，实现 userId 去重
ipcMain.handle('report-dai-dai-event', async (_, sessionId: string, userId: string, roomId: number) => {
  try {
    // 计算10分钟前的时间
    const tenMinutesAgo = new Date(Date.now() - duplicateTime);

    // 检查该 userId 在最近10分钟内是否已存在
    const existingRecord = await userDeduplicationRepository.findOne({
      where: {
        userId: userId,
        createdAt: MoreThan(tenMinutesAgo)
      }
    });

    if (existingRecord) {
      // 如果存在，说明是重复事件，直接忽略
      console.info(`🚫 [report-dai-dai-event] - userId: ${userId}, sessionId: ${sessionId}, roomId: ${roomId}`);
      return { success: true, message: '重复事件已忽略', duplicate: true };
    } else {
      // 如果不存在，说明是新事件，打印事件数据
      console.info(`✅ [report-dai-dai-event] 符合要求 - sessionId: ${sessionId}, userId: ${userId}, roomId: ${roomId}`);

      // 将 userId 保存到去重数据库
      const deduplicationRecord = new UserDeduplication();
      deduplicationRecord.userId = userId;
      await userDeduplicationRepository.save(deduplicationRecord);

      // 异步清理过期的去重记录（不等待，避免影响响应速度）
      setImmediate(async () => {
        try {
          await userDeduplicationRepository.delete({
            createdAt: LessThan(tenMinutesAgo)
          });
        } catch (error) {
          console.error('[report-dai-dai-event] 清理过期去重记录失败:', error);
        }
      });

      return { success: true, message: '已处理', duplicate: false };
    }
  } catch (error) {
    console.error('处理 [report-dai-dai-event] 事件失败:', error);
    return { success: false, error: error.message };
  }
});
