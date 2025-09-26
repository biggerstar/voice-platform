import { globalMainPathParser } from "@/global/global-main-path-parser";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalMainPathParser.serAppWorkRoot(path.resolve(fileURLToPath(import.meta!.url), '../../'))

import('./bootstrap')
