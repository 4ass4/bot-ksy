import Database from '../database/database.js';
import { Channel } from '../types/index.js';

export class ChannelService {
  constructor(private db: Database) {}

  async createChannel(telegramChannelId: string, name: string, inviteLink: string): Promise<Channel> {
    const result = await this.db.run(
      'INSERT INTO channels (telegram_channel_id, name, invite_link) VALUES (?, ?, ?)',
      [telegramChannelId, name, inviteLink]
    );

    return {
      id: result.lastID,
      telegram_channel_id: telegramChannelId,
      name: name,
      invite_link: inviteLink
    };
  }

  async getAllChannels(): Promise<Channel[]> {
    return await this.db.all<Channel>('SELECT * FROM channels ORDER BY name');
  }

  async getChannelById(id: number): Promise<Channel | undefined> {
    return await this.db.get<Channel>('SELECT * FROM channels WHERE id = ?', [id]);
  }

  async updateChannel(id: number, name: string, inviteLink: string): Promise<void> {
    await this.db.run(
      'UPDATE channels SET name = ?, invite_link = ? WHERE id = ?',
      [name, inviteLink, id]
    );
  }

  async deleteChannel(id: number): Promise<void> {
    await this.db.run('DELETE FROM channels WHERE id = ?', [id]);
  }

  async getChannelsByRaffleId(raffleId: number): Promise<Channel[]> {
    return await this.db.all<Channel>(
      `SELECT c.* FROM channels c 
       JOIN raffle_channels rc ON c.id = rc.channel_id 
       WHERE rc.raffle_id = ?`,
      [raffleId]
    );
  }
}