import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

@Injectable()
export class UploadService {
  constructor() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async saveFile(file: Express.Multer.File, prefix: string): Promise<string> {
    const ext = path.extname(file.originalname) || '.bin';
    const filename = `${prefix}-${randomUUID()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(filepath, file.buffer);
    return `/uploads/${filename}`;
  }

  getFilePath(url: string): string {
    const filename = path.basename(url);
    return path.join(UPLOAD_DIR, filename);
  }
}
