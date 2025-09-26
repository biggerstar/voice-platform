import { AccountSessionEntity } from "@/orm/entities/account-session"
import { ProductEntity } from "@/orm/entities/product"
import { ipcMain } from "electron"

// 产品
ipcMain.handle('get-product-data', async (_ev, options = {}) => {
  const startIndex = options.pageSize && options.pageSize ? options.pageSize * (options.currentPage - 1) : 0
  const [result, count] = await ProductEntity.findAndCount({
    where: options.where,
    take: options.pageSize || 50,
    skip: startIndex ?? 0
  })
  result.forEach((item: any, index) => {
    item.index = startIndex + index + 1
  })
  return {
    code: 0,
    data: {
      items: result,
      total: count
    }
  }
})


export async function getOneProduct(id: string) {
  try {
    // 使用 findOne 方法获取单条数据
    const product = await ProductEntity.findOne({
      where: { id: id.toString() } // 根据ID查询
    });

    if (!product) {
      return {
        code: 404,
        message: 'Product not found'
      };
    }

    return {
      code: 0,
      data: product
    };
  } catch (error) {
    console.error('Error fetching product:', error);
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
}
ipcMain.handle('get-one-product', async (_ev, id: string) => {
  return getOneProduct(id)
});

ipcMain.handle('delete-product', (_ev: any, ids: string[]) => {
  ProductEntity.delete(ids)
})

// 更新产品
export async function updatePruduct(id: string, data: Record<any, any>) {
  try {
    const product = await ProductEntity.findOne({
      where: { id: id.toString() }
    });

    if (!product) {
      return {
        code: 404,
        message: 'Product not found'
      };
    }

    Object.assign(product, data);
    await product.save();

    return {
      code: 0,
      data: product,
      message: 'Product updated successfully'
    };
  } catch (error) {
    console.error('Error updating product:', error);
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
}
ipcMain.handle('update-product', async (_ev: any, id: string, data: Record<any, any>) => {
  return updatePruduct(id, data)
});

// 账号
ipcMain.handle('get-account-session-data', async (_ev, options = {}) => {
  const startIndex = options.pageSize && options.pageSize ? options.pageSize * (options.currentPage - 1) : 0
  const [result, count] = await AccountSessionEntity.findAndCount({
    where: options.where,
    take: options.pageSize || 50,
    skip: startIndex ?? 0
  })
  result.forEach((item: any, index) => {
    item.index = startIndex + index + 1
  })
  return {
    code: 0,
    data: {
      items: result,
      total: count
    }
  }
})

ipcMain.handle('create-account-session', async (_ev: any, data: Record<any, any>) => {
  const fonud = await AccountSessionEntity.findOne({
    where: {
      name: data.name
    }
  })
  if (fonud) {
    return false
  }
  const accountSessionEntity = new AccountSessionEntity()
  Object.assign(accountSessionEntity, data)
  await accountSessionEntity.save()
  return true
})

ipcMain.handle('delete-account-session', (_ev: any, ids: string[]) => {
  AccountSessionEntity.delete(ids)
})

// 更新账号会话
ipcMain.handle('update-account-session', async (_ev: any, id: string, data: Record<any, any>) => {
  try {
    const accountSession = await AccountSessionEntity.findOne({
      where: { id: id.toString() }
    });

    if (!accountSession) {
      return {
        code: 404,
        message: 'Account session not found'
      };
    }

    // 如果更新名称，检查是否与其他记录重复
    if (data.name && data.name !== accountSession.name) {
      const existingSession = await AccountSessionEntity.findOne({
        where: {
          name: data.name
        }
      });

      if (existingSession) {
        return {
          code: 400,
          message: 'Account session with this name already exists'
        };
      }
    }

    Object.assign(accountSession, data);
    await accountSession.save();

    return {
      code: 0,
      data: accountSession,
      message: 'Account session updated successfully'
    };
  } catch (error) {
    console.error('Error updating account session:', error);
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
});
