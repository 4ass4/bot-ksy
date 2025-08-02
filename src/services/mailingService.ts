import Database from '../database/database.js';
import { Mailing, MailingType, MailingStatus } from '../types/index.js';

export class MailingService {
  constructor(private db: Database) {}

  async createMailing(
    mailingType: MailingType,
    messageText: string,
    targetRaffleId?: number,
    photoFileId?: string,
    videoFileId?: string,
    inlineKeyboardJson?: string,
    scheduleTime?: Date
  ): Promise<Mailing> {
    const result = await this.db.run(
      `INSERT INTO mailings (mailing_type, target_raffle_id, message_text, photo_file_id, 
       video_file_id, inline_keyboard_json, schedule_time, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mailingType,
        targetRaffleId,
        messageText,
        photoFileId,
        videoFileId,
        inlineKeyboardJson,
        scheduleTime?.toISOString(),
        scheduleTime ? MailingStatus.SCHEDULED : MailingStatus.SENDING
      ]
    );

    return {
      id: result.lastID,
      mailing_type: mailingType,
      target_raffle_id: targetRaffleId,
      message_text: messageText,
      photo_file_id: photoFileId,
      video_file_id: videoFileId,
      inline_keyboard_json: inlineKeyboardJson,
      schedule_time: scheduleTime,
      status: scheduleTime ? MailingStatus.SCHEDULED : MailingStatus.SENDING,
      sent_count: 0,
      failed_count: 0,
      created_at: new Date()
    };
  }

  async getAllMailings(): Promise<Mailing[]> {
    const mailings = await this.db.all<any>('SELECT * FROM mailings ORDER BY created_at DESC');
    return mailings.map(mailing => ({
      ...mailing,
      schedule_time: mailing.schedule_time ? new Date(mailing.schedule_time) : undefined,
      created_at: new Date(mailing.created_at)
    }));
  }

  async getScheduledMailings(): Promise<Mailing[]> {
    const now = new Date().toISOString();
    const mailings = await this.db.all<any>(
      'SELECT * FROM mailings WHERE status = ? AND schedule_time <= ?',
      [MailingStatus.SCHEDULED, now]
    );
    return mailings.map(mailing => ({
      ...mailing,
      schedule_time: new Date(mailing.schedule_time),
      created_at: new Date(mailing.created_at)
    }));
  }

  async getSendingMailings(): Promise<Mailing[]> {
    const mailings = await this.db.all<any>(
      'SELECT * FROM mailings WHERE status = ?',
      [MailingStatus.SENDING]
    );
    return mailings.map(mailing => ({
      ...mailing,
      schedule_time: mailing.schedule_time ? new Date(mailing.schedule_time) : undefined,
      created_at: new Date(mailing.created_at)
    }));
  }

  async updateMailingStatus(id: number, status: MailingStatus): Promise<void> {
    await this.db.run('UPDATE mailings SET status = ? WHERE id = ?', [status, id]);
  }

  async updateMailingStats(id: number, sentCount: number, failedCount: number): Promise<void> {
    await this.db.run(
      'UPDATE mailings SET sent_count = ?, failed_count = ? WHERE id = ?',
      [sentCount, failedCount, id]
    );
  }

  async cancelMailing(id: number): Promise<void> {
    await this.db.run('UPDATE mailings SET status = ? WHERE id = ?', [MailingStatus.CANCELED, id]);
  }

  async deleteMailing(id: number): Promise<void> {
    await this.db.run('DELETE FROM mailings WHERE id = ?', [id]);
  }

  async getMailingById(id: number): Promise<Mailing | null> {
    const mailing = await this.db.get<any>('SELECT * FROM mailings WHERE id = ?', [id]);
    if (!mailing) return null;
    
    return {
      ...mailing,
      schedule_time: mailing.schedule_time ? new Date(mailing.schedule_time) : undefined,
      created_at: new Date(mailing.created_at)
    };
  }
}