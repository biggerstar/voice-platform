import { app } from 'electron';
import { browserinternetView } from '../windows/browser';

export * from './ipc-axios';
export * from './ipc-browser';
export * from './ipc-daidai';
export * from './ipc-data-api';
export * from './ipc-parser-data';
export * from './ipc-renderer';

app.on('will-quit', () => {
  browserinternetView.close();
})
