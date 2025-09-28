import { globalEnv } from "@/global/global-env";
import { globalMainPathParser } from "@/global/global-main-path-parser";
import { AppDataSource } from "@/orm/data-source";
import { DaidaiLog } from "@/orm/entities/daidai-log";
import { UserDeduplication } from "@/orm/entities/user-deduplication";
import { ipcMain, screen, WebContentsView } from "electron";
import md5 from "md5";
import { LessThan, MoreThan } from "typeorm";
import { mainWindow } from "../windows/app/app";

// 日志仓库
const daidaiLogRepository = AppDataSource.getRepository(DaidaiLog);
// 去重仓库
const userDeduplicationRepository = AppDataSource.getRepository(UserDeduplication);

// 去重时间窗口：10分钟
const duplicateTime = 60 * 1000 * 10;

// 镜像任务窗口集合
const mirrorTaskViews: Map<string, WebContentsView> = new Map();

/**
 * 创建单个镜像任务窗口
 * @param options 窗口配置选项
 * @returns 创建结果
 */
async function createSingleMirrorTaskView(options: { name: string; type: string; url?: string }): Promise<{ success: boolean; message?: string; error?: string; viewId?: string }> {
  try {
    const { name, type, url = 'about:blank' } = options;
    const viewId = `${type}_${name}`;

    // 如果已经存在同名窗口，先关闭它
    if (mirrorTaskViews.has(viewId)) {
      const existingView = mirrorTaskViews.get(viewId)!;
      mainWindow.win.contentView.removeChildView(existingView);
      existingView.webContents.close();
      mirrorTaskViews.delete(viewId);
    }

    // 创建新的 WebContentsView
    const mirrorTaskView = new WebContentsView({
      webPreferences: {
        spellcheck: false,
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: false,
        webSecurity: false,
        preload: globalMainPathParser.resolvePreload('browser.cjs').toString(),
        partition: name ? 'persist:' + md5(String(type) + name) : 'persist:encommerce',
        additionalArguments: [
          `daidai-name=${name}`
        ]
      }
    });

    mainWindow.win.contentView.addChildView(mirrorTaskView);
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // 设置窗口大小
    const viewWidth = 600;
    const viewHeight = 200;
    const offscreenX = screenWidth + 100; // 移动到屏幕右侧外面
    const offscreenY = 0;
    mirrorTaskView.setBounds({
      x: offscreenX,
      y: offscreenY,
      width: viewWidth,
      height: viewHeight
    });
    mirrorTaskView.setVisible(false);

    // 加载页面
    await mirrorTaskView.webContents.loadURL(url);

    // 在开发模式下打开开发者工具
    if (globalEnv.isDev) {
      // mirrorTaskView.webContents.openDevTools({ mode: 'detach' });
    }

    mirrorTaskViews.set(viewId, mirrorTaskView);

    return { success: true, message: `镜像任务窗口 ${viewId} 创建成功`, viewId };

  } catch (error) {
    console.error(`❌ [createSingleMirrorTaskView] 创建镜像任务窗口失败:`, error);
    return { success: false, error: error.message };
  }
}

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
    const { where, pageSize = 50, currentPage = 1 } = options;
    const startIndex = pageSize && currentPage ? pageSize * (currentPage - 1) : 0;

    const query = daidaiLogRepository.createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(startIndex)
      .take(pageSize);

    // 处理 where 条件
    if (where) {
      if (where.accountSessionId) {
        query.andWhere('log.accountSessionId = :accountSessionId', { accountSessionId: where.accountSessionId });
      }
      if (where.type) {
        // type 字段可能需要根据实际需求处理，这里暂时忽略
      }
    }

    const [result, count] = await query.getManyAndCount();

    // 添加序号
    result.forEach((item: any, index) => {
      item.index = startIndex + index + 1;
    });

    return {
      code: 0,
      data: {
        items: result,
        total: count
      }
    };
  } catch (error) {
    console.error('获取日志列表失败:', error);
    return {
      code: 500,
      message: error.message
    };
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

// 清除所有日志数据（软件启动时调用）
ipcMain.handle('clear-all-daidai-logs', async () => {
  try {
    await daidaiLogRepository.clear();
    console.log('已清除所有带带日志数据');
    return { success: true };
  } catch (error) {
    console.error('清除所有日志失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-mirror-task', async (_, options = []) => {
  console.info(`🚀 ~ start-mirror-task:`, options)

  try {
    // 支持单个对象或数组参数
    const taskList = Array.isArray(options) ? options : [options];

    if (taskList.length === 0) {
      return { success: false, error: '未提供任务配置' };
    }

    const results = [];
    const errors = [];

    // 并行创建所有窗口
    for (const task of taskList) {
      const { name, type, url } = task;

      if (!name || !type) {
        errors.push(`任务配置无效: ${JSON.stringify(task)}`);
        continue;
      }

      const result = await createSingleMirrorTaskView({ name, type, url });
      results.push(result);

      if (!result.success) {
        errors.push(result.error || '未知错误');
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = taskList.length;

    if (errors.length === 0) {
      console.info(`✅ [start-mirror-task] 所有 ${totalCount} 个镜像任务窗口创建成功`);
      return {
        success: true,
        message: `所有 ${totalCount} 个镜像任务窗口创建成功`,
        results,
        activeCount: mirrorTaskViews.size
      };
    } else if (successCount > 0) {
      console.warn(`⚠️ [start-mirror-task] 部分窗口创建成功: ${successCount}/${totalCount}`);
      return {
        success: true,
        message: `部分窗口创建成功: ${successCount}/${totalCount}`,
        results,
        errors,
        activeCount: mirrorTaskViews.size
      };
    } else {
      console.error(`❌ [start-mirror-task] 所有窗口创建失败`);
      return {
        success: false,
        error: `所有窗口创建失败: ${errors.join('; ')}`,
        results,
        errors
      };
    }

  } catch (error) {
    console.error('❌ [start-mirror-task] 处理镜像任务失败:', error);
    return { success: false, error: error.message };
  }
})

ipcMain.handle('stop-mirror-task', (_, viewIds = []) => {
  console.info(`🚀 ~ stop-mirror-task:`, viewIds)

  try {
    // 如果没有指定 viewIds，则关闭所有窗口
    const targetViewIds = Array.isArray(viewIds) && viewIds.length > 0
      ? viewIds
      : Array.from(mirrorTaskViews.keys());

    if (targetViewIds.length === 0) {
      console.info('ℹ️ [stop-mirror-task] 没有运行中的镜像任务窗口');
      return { success: true, message: '没有运行中的镜像任务窗口', activeCount: 0 };
    }

    const results = [];
    const errors = [];

    for (const viewId of targetViewIds) {
      try {
        const view = mirrorTaskViews.get(viewId);
        if (view) {
          // 从主窗口移除
          mainWindow.win.contentView.removeChildView(view);
          // 关闭 WebContents
          view.webContents.close();
          // 从集合中删除
          mirrorTaskViews.delete(viewId);

          results.push({ viewId, success: true, message: '窗口已关闭' });
          console.info(`✅ [stop-mirror-task] 镜像任务窗口 ${viewId} 已关闭`);
        } else {
          results.push({ viewId, success: false, message: '窗口不存在' });
          console.warn(`⚠️ [stop-mirror-task] 镜像任务窗口 ${viewId} 不存在`);
        }
      } catch (error) {
        const errorMsg = `关闭窗口 ${viewId} 失败: ${error.message}`;
        errors.push(errorMsg);
        results.push({ viewId, success: false, error: errorMsg });
        console.error(`❌ [stop-mirror-task] ${errorMsg}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = targetViewIds.length;

    if (errors.length === 0) {
      console.info(`✅ [stop-mirror-task] 所有 ${totalCount} 个镜像任务窗口已关闭`);
      return {
        success: true,
        message: `所有 ${totalCount} 个镜像任务窗口已关闭`,
        results,
        activeCount: mirrorTaskViews.size
      };
    } else {
      console.warn(`⚠️ [stop-mirror-task] 部分窗口关闭成功: ${successCount}/${totalCount}`);
      return {
        success: successCount > 0,
        message: `部分窗口关闭成功: ${successCount}/${totalCount}`,
        results,
        errors,
        activeCount: mirrorTaskViews.size
      };
    }
  } catch (error) {
    console.error('❌ [stop-mirror-task] 关闭镜像任务窗口失败:', error);
    return { success: false, error: error.message };
  }
})

// 获取镜像任务状态
ipcMain.handle('get-mirror-task-status', () => {
  try {
    const activeViews = Array.from(mirrorTaskViews.keys());
    const isRunning = activeViews.length > 0;
    return {
      success: true,
      isRunning,
      activeCount: activeViews.length,
      activeViewIds: activeViews,
      message: isRunning
        ? `当前有 ${activeViews.length} 个镜像任务窗口在运行`
        : '当前没有运行中的镜像任务窗口'
    };
  } catch (error) {
    console.error('❌ [get-mirror-task-status] 获取镜像任务状态失败:', error);
    return { success: false, error: error.message };
  }
})

// 处理 DaiDai 事件上报，实现 userId 去重
ipcMain.handle('report-dai-dai-event', async (_, reportData: { sessionId: string; userId: string; roomId: number; data: any }): Promise<void> => {
  try {
    const { sessionId, userId, roomId, data } = reportData;

    // 验证必要参数
    if (!sessionId || !userId || !roomId) {
      console.error('[report-dai-dai-event] 缺少必要参数:', { sessionId, userId, roomId });
      return
    }

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
      console.info(`🚫 [report-dai-dai-event] 重复事件已忽略 - userId: ${userId}, sessionId: ${sessionId}, roomId: ${roomId}`);
      return
    } else {
      console.info(`✅ [report-dai-dai-event] 符合要求 - sessionId: ${sessionId}, userId: ${userId}, roomId: ${roomId}`, data);

      // 将 userId 保存到去重数据库
      const deduplicationRecord = new UserDeduplication();
      deduplicationRecord.userId = userId;
      await userDeduplicationRepository.save(deduplicationRecord);
    }
  } catch (error) {
    console.error('处理 [report-dai-dai-event] 事件失败:', error);
  }
});

// 异步清理过期的去重记录（不等待，避免影响响应速度）
setInterval(async () => {
  try {
    await userDeduplicationRepository.delete({
      createdAt: LessThan(new Date(Date.now() - duplicateTime))
    });
  } catch (error) {
    console.error('[report-dai-dai-event] 清理过期去重记录失败:', error);
  }
}, duplicateTime);

