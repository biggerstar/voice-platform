import { ApplicationDirEnum } from '@/enum/app-dir';
import path from 'node:path';
import process from 'node:process';

class GlobalEnv {
  public getEnv(key: keyof NodeJS.ProcessEnv | string) {
    return process.env[key];
  }

  public setEnv(key: keyof NodeJS.ProcessEnv | string, value: string) {
    process.env[key] = value;
  }

  public get isDev() {
    return process.env['NODE_ENV'] === 'development';
  }

  public get isProd() {
    return process.env['NODE_ENV'] === 'production';
  }

  public getWebRootUrl() {
    return ELECTRON_DEV_SERVER_URL || path.resolve(process.env['APP_WORK_ROOT'], ApplicationDirEnum.web);
  }

  public disableSecurityWarnings() {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
  }
}

export const globalEnv = new GlobalEnv();
