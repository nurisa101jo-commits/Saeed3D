import {safeStorage} from 'electron';
import type {Database} from './database.js';

export class Credentials {
  constructor(private db: Database) {}
  get(name: string): string | null {
    const raw = this.db.getSetting('secret:'+name);
    if (!raw) return null;
    try {
      if (raw?.encrypted) return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(raw.encrypted,'base64')) : null;
      return typeof raw === 'string' ? raw : null;
    } catch { return null; }
  }
  set(name: string, value: string) {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value).toString('base64');
      this.db.setSetting('secret:'+name,{encrypted});
    } else {
      throw new Error('Windows secure credential storage is unavailable');
    }
  }
  remove(name: string) { this.db.deleteSetting('secret:'+name); }
}