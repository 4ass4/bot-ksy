import Database from '../database/database.js';

export interface OfficialChannel {
  id: number;
  telegram_channel_id: string;
  name: string;
  invite_link: string;
  description?: string;
  created_at: string;
}

export class OfficialChannelService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getOfficialChannel(): Promise<OfficialChannel | null> {
    const result = await this.db.get('SELECT * FROM official_channel ORDER BY id DESC LIMIT 1') as OfficialChannel | null;
    return result;
  }

  async createOfficialChannel(telegramChannelId: string, name: string, inviteLink: string, description?: string): Promise<number> {
    // Удаляем предыдущий официальный канал (может быть только один)
    await this.db.run('DELETE FROM official_channel');
    
    const result = await this.db.run(
      'INSERT INTO official_channel (telegram_channel_id, name, invite_link, description) VALUES (?, ?, ?, ?)',
      [telegramChannelId, name, inviteLink, description]
    );
    
    return result.lastID!;
  }

  async updateOfficialChannel(id: number, telegramChannelId: string, name: string, inviteLink: string, description?: string): Promise<void> {
    await this.db.run(
      'UPDATE official_channel SET telegram_channel_id = ?, name = ?, invite_link = ?, description = ? WHERE id = ?',
      [telegramChannelId, name, inviteLink, description, id]
    );
  }

  async deleteOfficialChannel(): Promise<void> {
    await this.db.run('DELETE FROM official_channel');
  }

  async hasOfficialChannel(): Promise<boolean> {
    const result = await this.db.get('SELECT COUNT(*) as count FROM official_channel') as { count: number } | null;
    return (result?.count || 0) > 0;
  }
} 