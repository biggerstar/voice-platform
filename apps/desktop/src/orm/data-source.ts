import { globalMainPathParser } from "@/global/global-main-path-parser";
import 'reflect-metadata';
import { DataSource } from "typeorm";
import { AccountSessionEntity } from "./entities/account-session";
import { AppConfigEntity } from "./entities/app-config";
import { BotEntity } from "./entities/bot";
import { DaidaiLog } from "./entities/daidai-log";
import { ProductEntity } from "./entities/product";
import { UserDeduplication } from "./entities/user-deduplication";

const dbName = process.cwd().split('/').splice(2).join('').replaceAll('-', '')
console.log("🚀 ~ dbName:", globalMainPathParser.resolveDB(dbName))

// 配置SQLite数据源
export const AppDataSource = new DataSource({
  type: "sqlite",
  database: globalMainPathParser.resolveDB(dbName), // SQLite数据库文件路径
  logging: false, // 启用日志
  synchronize: true,
  extra: {
    // 防止加载其他数据库驱动 
    driver: "sqlite3"
  },
  entities: [
    AppConfigEntity,
    ProductEntity,
    AccountSessionEntity,
    DaidaiLog,
    UserDeduplication,
    BotEntity,
  ], // 注册实体
  // 或者使用通配符匹配所有实体文件
  // entities: ["src/entity/**/*.ts"],
});

// 注意：数据源初始化现在在需要时进行，而不是在导入时自动初始化
// 这样可以避免在实体元数据未加载完成时就使用数据源的问题
