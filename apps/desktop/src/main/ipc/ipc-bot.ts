import { BotEntity } from "@/orm/entities/bot";
import { AccountSessionEntity } from "@/orm/entities/account-session";
import { ipcMain } from "electron";

// 获取机器人列表
ipcMain.handle('get-bot-list', async (_ev, options = {}) => {
  try {
    const startIndex = options.pageSize && options.currentPage ? options.pageSize * (options.currentPage - 1) : 0;
    const [result, count] = await BotEntity.findAndCount({
      where: options.where,
      take: options.pageSize || 50,
      skip: startIndex ?? 0,
      order: { created_time: 'DESC' }
    });

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
    console.error('获取机器人列表失败:', error);
    return {
      code: 1,
      message: '获取机器人列表失败',
      error: error.message
    };
  }
});

// 创建机器人
ipcMain.handle('create-bot', async (_ev, data) => {
  try {
    // 检查名称是否已存在
    const existingBot = await BotEntity.findOne({ where: { name: data.name } });
    if (existingBot) {
      return {
        code: 1,
        message: '机器人名称已存在'
      };
    }

    const bot = new BotEntity();
    Object.assign(bot, data);
    await bot.save();

    return {
      code: 0,
      data: bot,
      message: '机器人创建成功'
    };
  } catch (error) {
    console.error('创建机器人失败:', error);
    return {
      code: 1,
      message: '创建机器人失败',
      error: error.message
    };
  }
});

// 更新机器人
ipcMain.handle('update-bot', async (_ev, id: string, data) => {
  try {
    const bot = await BotEntity.findOne({ where: { id } });
    if (!bot) {
      return {
        code: 1,
        message: '机器人不存在'
      };
    }

    // 检查名称是否与其他机器人重复
    if (data.name && data.name !== bot.name) {
      const existingBot = await BotEntity.findOne({ where: { name: data.name } });
      if (existingBot) {
        return {
          code: 1,
          message: '机器人名称已存在'
        };
      }
    }

    Object.assign(bot, data);
    await bot.save();

    return {
      code: 0,
      data: bot,
      message: '机器人更新成功'
    };
  } catch (error) {
    console.error('更新机器人失败:', error);
    return {
      code: 1,
      message: '更新机器人失败',
      error: error.message
    };
  }
});

// 删除机器人
ipcMain.handle('delete-bot', async (_ev, ids: string[]) => {
  try {
    // 检查要删除的机器人是否被账号会话绑定
    const botsToDelete = await BotEntity.findByIds(ids);
    const boundBots = [];

    for (const bot of botsToDelete) {
      // 检查是否有账号会话绑定了这个机器人（普通机器人）
      const boundSessions = await AccountSessionEntity.find({
        where: { webhook_bot: bot.name }
      });

      // 检查是否有账号会话绑定了这个机器人（榜单机器人）
      const leaderboardBoundSessions = await AccountSessionEntity.find({
        where: { leaderboard_bot: bot.name }
      });

      const allBoundSessions = [...boundSessions, ...leaderboardBoundSessions];
      
      if (allBoundSessions.length > 0) {
        const sessionNames = allBoundSessions.map(session => session.name);
        const uniqueSessionNames = [...new Set(sessionNames)]; // 去重
        boundBots.push({
          botName: bot.name,
          boundSessions: uniqueSessionNames,
          webhookBindings: boundSessions.length,
          leaderboardBindings: leaderboardBoundSessions.length
        });
      }
    }

    // 如果有机器人被绑定，返回错误信息
    if (boundBots.length > 0) {
      const errorMessages = boundBots.map(bot => {
        const bindingTypes = [];
        if (bot.webhookBindings > 0) {
          bindingTypes.push('普通机器人');
        }
        if (bot.leaderboardBindings > 0) {
          bindingTypes.push('榜单机器人');
        }
        return `机器人 "${bot.botName}" 已被账号 [${bot.boundSessions.join('、')}] 绑定为 ${bindingTypes.join('、')}`;
      });
      
      return {
        code: 1,
        message: `无法删除以下机器人：\n${errorMessages.join('\n')}\n\n请先解除绑定后再删除。`,
        boundBots
      };
    }

    // 如果没有绑定关系，执行删除
    await BotEntity.delete(ids);
    return {
      code: 0,
      message: `成功删除 ${ids.length} 个机器人`
    };
  } catch (error) {
    console.error('删除机器人失败:', error);
    return {
      code: 1,
      message: '删除机器人失败',
      error: error.message
    };
  }
});

// 获取单个机器人
ipcMain.handle('get-one-bot', async (_ev, id: string) => {
  try {
    const bot = await BotEntity.findOne({ where: { id } });
    if (!bot) {
      return {
        code: 1,
        message: '机器人不存在'
      };
    }

    return {
      code: 0,
      data: bot
    };
  } catch (error) {
    console.error('获取机器人失败:', error);
    return {
      code: 1,
      message: '获取机器人失败',
      error: error.message
    };
  }
});