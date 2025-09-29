import { globalEnv } from "@/global/global-env";
import { globalMainPathParser } from "@/global/global-main-path-parser";
import { AppDataSource } from "@/orm/data-source";
import { AppConfigEntity } from "@/orm/entities/app-config";
import { DaidaiLog } from "@/orm/entities/daidai-log";
import { UserDeduplication } from "@/orm/entities/user-deduplication";
import { ipcMain, screen, WebContentsView } from "electron";
import md5 from "md5";
import { LessThan, MoreThan } from "typeorm";
import { sendWebhookBySession, validateSessionsWebhook } from "../webhook/weixin";
import { mainWindow } from "../windows/app/app";

// 日志仓库
const daidaiLogRepository = AppDataSource.getRepository(DaidaiLog);
// 去重仓库
const userDeduplicationRepository = AppDataSource.getRepository(UserDeduplication);
// 配置仓库
const appConfigRepository = AppDataSource.getRepository(AppConfigEntity);

// 去重时间窗口：1小时
const duplicateTime = 60 * 60 * 1000;

// 镜像任务窗口集合
const mirrorTaskViews: Map<string, WebContentsView> = new Map();

/**
 * 检查指定的会话是否正在使用中
 * @param viewId 视图ID，格式为 ${type}_${name}
 * @returns 是否正在使用
 */
export function checkSessionInUse(viewId: string): boolean {
  return mirrorTaskViews.has(viewId);
}

/**
 * 获取当前监控状态
 * @returns 监控状态信息
 */
export function getMirrorTaskStatus(): { isRunning: boolean; activeCount: number; activeViewIds: string[] } {
  const activeViews = Array.from(mirrorTaskViews.keys());
  const isRunning = activeViews.length > 0;
  return {
    isRunning,
    activeCount: activeViews.length,
    activeViewIds: activeViews
  };
}

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

    // 监听渲染进程的console消息
    mirrorTaskView.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const prefix = `[${viewId}]`;
      switch (level) {
        case 0: // info
          console.info(`${prefix} ${message}`);
          break;
        case 1: // warning
          console.warn(`${prefix} ${message}`);
          break;
        case 2: // error
          console.error(`${prefix} ${message}`);
          break;
        default:
          console.log(`${prefix} ${message}`);
      }
    });

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
ipcMain.handle('update-daidai-log', async (_, id: string, status: string, message?: string, roomId?: string, chatroomName?: string) => {
  console.info(`[update-daidai-log]`, chatroomName || '\t', ' status=', status, ' message=', message, ' roomId', roomId)
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
        existingLog.chatroomName = chatroomName || existingLog.chatroomName;
        existingLog.updatedAt = new Date();
        log = existingLog;
      } else {
        // 如果不存在，创建新记录
        log = new DaidaiLog();
        log.accountSessionId = id;
        log.status = status;
        log.message = message || '';
        log.roomId = roomId;
        log.chatroomName = chatroomName || '';
      }
    } else {
      // 如果没有 roomId，直接创建新记录
      return { success: false, data: null };
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

// 重连房间
ipcMain.handle('reconnect-room', async (_, options: {
  roomId: string;
  accountSessionId: string;
  chatroomName?: string;
}) => {
  try {
    const { roomId, accountSessionId, chatroomName } = options;
    console.log('🔄 [reconnect-room] 开始重连房间:', { roomId, accountSessionId, chatroomName });

    // 根据 accountSessionId 找到对应的镜像任务窗口
    const viewId = `daidai_${accountSessionId}`;
    const targetView = mirrorTaskViews.get(viewId);

    if (!targetView) {
      console.error(`❌ [reconnect-room] 未找到对应的镜像任务窗口: ${viewId}`);
      return {
        success: false,
        error: `未找到对应的镜像任务窗口: ${viewId}`
      };
    }

    // 向目标窗口发送重连事件
    targetView.webContents.send('reconnect-room-request', {
      roomId,
      accountSessionId,
      chatroomName
    });

    console.log(`✅ [reconnect-room] 重连请求已发送到窗口: ${viewId}`);
    return {
      success: true,
      message: `重连请求已发送到窗口: ${viewId}`
    };

  } catch (error) {
    console.error('❌ [reconnect-room] 重连房间失败:', error);
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

      // 发送到 Webhook
      try {
        // 构建 markdown 格式的用户信息卡片
        const userInfo = data; // data 包含了用户信息
        const favoriteGamesText = Array.isArray(userInfo.favoriteGames) && userInfo.favoriteGames.length > 0
          ? userInfo.favoriteGames.join('、')
          : '无';

//         const webhookContent = `## 🎮 进房消息
// > **用户ID：** ${userInfo.userId}
// > **昵称：** ${userInfo.nickName}
// > **姓别：** ${userInfo.sex}
// > **等级：** ${userInfo.wealthLevelName}
// > **是否萌新：** ${userInfo.mengxin ? '是' : '否'}
// > **喜欢的内容：** ${favoriteGamesText}

// ---
// **房间ID：** ${roomId}  
// **当前时间：** ${new Date().toLocaleString('zh-CN')}`;

   const webhookContent = `🎮 进房消息
用户ID: ${userInfo.userId}
昵称: ${userInfo.nickName}
姓别: ${userInfo.sex}
等级: ${userInfo.wealthLevelName}
是否萌新: ${userInfo.mengxin ? '是' : '否'}
喜欢的内容: ${favoriteGamesText}

当前时间: ${new Date().toLocaleString('zh-CN')}`;
        const result = await sendWebhookBySession({
          sessionId,
          content: webhookContent,
          msgType: 'text'
        });

        if (result.success) {
          console.info(`📤 [report-dai-dai-event] Webhook 发送成功 - sessionId: ${sessionId}`);
          // 增加进房统计计数
          await incrementEnterRoomCount();
        } else {
          console.error(`❌ [report-dai-dai-event] Webhook 发送失败 - sessionId: ${sessionId}, error: ${result.error}`);
        }
      } catch (webhookError) {
        console.error(`❌ [report-dai-dai-event] Webhook 发送异常 - sessionId: ${sessionId}`, webhookError);
      }
    }
  } catch (error) {
    console.error('处理 [report-dai-dai-event] 事件失败:', error);
  }
});

// 添加 webhook 验证的 IPC 处理函数
ipcMain.handle('validate-sessions-webhook', async (_, sessionIds: string[]) => {
  try {
    const result = await validateSessionsWebhook(sessionIds);
    return result;
  } catch (error) {
    console.error('[validate-sessions-webhook] 验证失败:', error);
    return {
      success: false,
      unboundSessions: [],
      message: `验证失败: ${error.message}`
    };
  }
});

// 获取房间榜单数据的 IPC 处理函数
ipcMain.handle('fetch-room-leaderboard-data', async (_, options: {
  sessionId: string;
  roomId: string;
}): Promise<{
  success: boolean;
  data?: {
    meiliTopInfo: any[];
    wealthTopInfo: any[];
  };
  error?: string;
}> => {
  try {
    const { sessionId, roomId } = options;
    console.log(`🚀 [fetch-room-leaderboard-data] 开始获取房间 ${roomId} 的榜单数据`);

    // 根据 sessionId 找到对应的镜像任务窗口
    const viewId = `daidai_${sessionId}`;
    const targetView = mirrorTaskViews.get(viewId);

    if (!targetView) {
      const error = `未找到对应的镜像任务窗口: ${viewId}`;
      console.error(`❌ [fetch-room-leaderboard-data] ${error}`);
      return { success: false, error };
    }

    // 创建一个 Promise 来等待渲染进程的响应
    return new Promise((resolve) => {
      const requestId = `leaderboard_${sessionId}_${roomId}_${Date.now()}`;
      const timeoutId = setTimeout(() => {
        console.error(`❌ [fetch-room-leaderboard-data] 获取房间 ${roomId} 榜单数据超时`);
        resolve({
          success: false,
          error: '获取榜单数据超时'
        });
      }, 30000); // 30秒超时

      // 监听来自WebContentsView的IPC响应
      const responseHandler = (event: Electron.IpcMainEvent, responseData: any) => {
        if (responseData.requestId === requestId) {
          clearTimeout(timeoutId);
          ipcMain.off('leaderboard-data-response', responseHandler);

          if (responseData.success) {
            console.log(`✅ [fetch-room-leaderboard-data] 成功获取房间 ${roomId} 的榜单数据`);
            resolve({
              success: true,
              data: responseData.data
            });
          } else {
            console.error(`❌ [fetch-room-leaderboard-data] 获取榜单数据失败: ${responseData.error}`);
            resolve({
              success: false,
              error: responseData.error
            });
          }
        }
      };

      // 监听来自渲染进程的响应
      ipcMain.on('leaderboard-data-response', responseHandler);

      // 向渲染进程发送获取榜单数据的请求
      console.log(`📤 [fetch-room-leaderboard-data] 向WebContentsView发送请求:`, {
        requestId,
        roomId,
        sessionId,
        viewId
      });
      targetView.webContents.send('fetch-leaderboard-data-request', {
        requestId,
        roomId,
        sessionId
      });
      console.log(`📤 [fetch-room-leaderboard-data] 请求已发送到WebContentsView`);
    });

  } catch (error) {
    console.error('❌ [fetch-room-leaderboard-data] 获取榜单数据失败:', error);
    return { success: false, error: error.message };
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

// 导出榜单数据获取函数，供调度器直接调用
export async function fetchRoomLeaderboardData(options: {
  sessionId: string;
  roomId: string;
}): Promise<{
  success: boolean;
  data?: {
    meiliTopInfo: any[];
    wealthTopInfo: any[];
  };
  error?: string;
}> {
  try {
    const { sessionId, roomId } = options;
    const viewId = `daidai_${sessionId}`;
    const targetView = mirrorTaskViews.get(viewId);

    if (!targetView) {
      const error = `未找到对应的镜像任务窗口: ${viewId}`;
      console.error(`❌ [fetchRoomLeaderboardData] ${error}`);
      console.error(`❌ [fetchRoomLeaderboardData] 可用的viewId列表:`, Array.from(mirrorTaskViews.keys()));
      return { success: false, error };
    }

    // 生成唯一的请求ID
    const requestId = `leaderboard_${sessionId}_${roomId}_${Date.now()}`;

    // 创建一个 Promise 来等待渲染进程的响应
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        ipcMain.off('leaderboard-data-response', responseHandler);
        resolve({
          success: false,
          error: '获取榜单数据超时'
        });
      }, 30000); // 30秒超时

      // 监听渲染进程的响应
      const responseHandler = (event: any, responseData: any) => {
        console.log(`📥 [fetchRoomLeaderboardData] 收到IPC响应，requestId: ${responseData.requestId}, 期望: ${requestId}`);
        if (responseData.requestId === requestId) {
          clearTimeout(timeoutId);
          ipcMain.off('leaderboard-data-response', responseHandler);

          if (responseData.success) {
            console.log(`✅ [fetchRoomLeaderboardData] 成功获取房间 ${roomId} 的榜单数据`);
            resolve({
              success: true,
              data: responseData.data
            });
          } else {
            console.error(`❌ [fetchRoomLeaderboardData] 获取榜单数据失败: ${responseData.error}`);
            resolve({
              success: false,
              error: responseData.error
            });
          }
        }
      };

      // 监听来自渲染进程的响应
      ipcMain.on('leaderboard-data-response', responseHandler);

      // 向渲染进程发送获取榜单数据的请求
      targetView.webContents.send('fetch-leaderboard-data-request', {
        requestId,
        roomId,
        sessionId
      });
      console.log(`📤 [fetchRoomLeaderboardData] IPC请求已发送到视图 ${viewId}`);
    });

  } catch (error) {
    console.error('❌ [fetchRoomLeaderboardData] 获取榜单数据失败:', error);
    return { success: false, error: error.message };
  }
}

// ==================== 统计计数管理 ====================

// 统计计数的配置键
const STATS_KEYS = {
  ENTER_ROOM_COUNT: 'daidai_enter_room_count',
  WEALTH_RANK_COUNT: 'daidai_wealth_rank_count'
};

/**
 * 获取统计计数
 * @param key 统计键
 * @returns 计数值
 */
async function getStatCount(key: string): Promise<number> {
  try {
    const config = await appConfigRepository.findOne({ where: { key } });
    return config ? parseInt(config.value) || 0 : 0;
  } catch (error) {
    console.error(`获取统计计数失败 [${key}]:`, error);
    return 0;
  }
}

/**
 * 设置统计计数
 * @param key 统计键
 * @param value 计数值
 */
async function setStatCount(key: string, value: number): Promise<void> {
  try {
    const config = await appConfigRepository.findOne({ where: { key } });
    if (config) {
      config.value = value.toString();
      await appConfigRepository.save(config);
    } else {
      const newConfig = new AppConfigEntity();
      newConfig.key = key;
      newConfig.value = value.toString();
      await appConfigRepository.save(newConfig);
    }
  } catch (error) {
    console.error(`设置统计计数失败 [${key}]:`, error);
  }
}

/**
 * 增加统计计数
 * @param key 统计键
 * @param increment 增加的数量，默认为1
 */
async function incrementStatCount(key: string, increment: number = 1): Promise<number> {
  try {
    const currentCount = await getStatCount(key);
    const newCount = currentCount + increment;
    await setStatCount(key, newCount);
    return newCount;
  } catch (error) {
    console.error(`增加统计计数失败 [${key}]:`, error);
    return 0;
  }
}

/**
 * 重置所有统计计数
 */
export async function resetAllStatCounts(): Promise<void> {
  try {
    await setStatCount(STATS_KEYS.ENTER_ROOM_COUNT, 0);
    await setStatCount(STATS_KEYS.WEALTH_RANK_COUNT, 0);
    console.log('✅ 所有统计计数已重置');
  } catch (error) {
    console.error('❌ 重置统计计数失败:', error);
  }
}

// 获取统计数据
ipcMain.handle('get-daidai-stats', async () => {
  try {
    const enterRoomCount = await getStatCount(STATS_KEYS.ENTER_ROOM_COUNT);
    const wealthRankCount = await getStatCount(STATS_KEYS.WEALTH_RANK_COUNT);
    
    return {
      success: true,
      data: {
        enterRoomCount,
        wealthRankCount
      }
    };
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return { success: false, error: error.message };
  }
});

// 重置统计数据
ipcMain.handle('reset-daidai-stats', async () => {
  try {
    await resetAllStatCounts();
    return { success: true };
  } catch (error) {
    console.error('重置统计数据失败:', error);
    return { success: false, error: error.message };
  }
});

// 增加进房统计计数
async function incrementEnterRoomCount(): Promise<void> {
  await incrementStatCount(STATS_KEYS.ENTER_ROOM_COUNT);
}

// 增加财富榜统计计数
export async function incrementWealthRankCount(): Promise<void> {
  await incrementStatCount(STATS_KEYS.WEALTH_RANK_COUNT);
}

