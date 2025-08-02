import Database from '../database/database.js';
import { BotSettings } from '../types/index.js';

export class BotSettingsService {
  constructor(private db: Database) {}

  async getSettings(): Promise<BotSettings> {
    const settings = await this.db.get<any>('SELECT * FROM bot_settings WHERE id = 1');
    if (!settings) {
      // Создаем настройки по умолчанию
      const defaultSettings = {
        id: 1,
        welcome_message: '👋 Добро пожаловать в бот для розыгрышей!\n\n🎁 Здесь вы можете участвовать в различных розыгрышах и конкурсах.',
        cover_photo_file_id: null,
        updated_at: new Date()
      };
      await this.db.run(
        'INSERT INTO bot_settings (id, welcome_message, cover_photo_file_id, updated_at) VALUES (?, ?, ?, ?)',
        [defaultSettings.id, defaultSettings.welcome_message, defaultSettings.cover_photo_file_id, defaultSettings.updated_at.toISOString()]
      );
      return defaultSettings;
    }

    return {
      ...settings,
      updated_at: new Date(settings.updated_at)
    };
  }

  async updateWelcomeMessage(message: string): Promise<void> {
    await this.db.run(
      'UPDATE bot_settings SET welcome_message = ?, updated_at = ? WHERE id = 1',
      [message, new Date().toISOString()]
    );
  }

  async updateCoverPhoto(fileId: string): Promise<void> {
    await this.db.run(
      'UPDATE bot_settings SET cover_photo_file_id = ?, updated_at = ? WHERE id = 1',
      [fileId, new Date().toISOString()]
    );
  }

  async removeCoverPhoto(): Promise<void> {
    await this.db.run(
      'UPDATE bot_settings SET cover_photo_file_id = NULL, updated_at = ? WHERE id = 1',
      [new Date().toISOString()]
    );
  }
} 