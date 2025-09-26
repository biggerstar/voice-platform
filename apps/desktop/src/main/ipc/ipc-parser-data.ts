import { ProductEntity } from "@/orm/entities/product";
import { ipcMain } from "electron";

// 入库成功返回 true, 失败 false
ipcMain.handle('save-product-data', async (_, data) => {
  if (!data) return;
  const found = await ProductEntity.findOne({ where: { id: data.id } })
  const product = new ProductEntity();
  Object.assign(product, data);
  await product.save()
  if (found) {
    console.log(data.type, ' - 已存在: 本次进行更新 - ', product.title)
  } else {
    console.log(data.type, ' - 入库成功: ', product.title)
  }
  return !found
})
