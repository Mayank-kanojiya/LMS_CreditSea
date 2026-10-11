import { mkdirSync } from 'fs';
import path from 'path';

export const UPLOADS_DIR = path.resolve(__dirname, '../../src/uploads');

mkdirSync(UPLOADS_DIR, { recursive: true });
