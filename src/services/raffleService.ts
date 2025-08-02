import Database from '../database/database.js';
import { Raffle, RaffleStatus, Participant, Winner } from '../types/index.js';

export class RaffleService {
  constructor(private db: Database) {}

  async createRaffle(
    prizeDescription: string, 
    winnersCount: number, 
    endDate: Date,
    channelIds: number[],
    photoFileId?: string,
    videoFileId?: string,
    referralRequirement: boolean = false,
    minReferrals: number = 0,
    maxReferrals: number = 0,
    referralBonus?: string,
    bonusMultiplier: number = 1.0
  ): Promise<Raffle> {
    const result = await this.db.run(
      'INSERT INTO raffles (prize_description, photo_file_id, video_file_id, winners_count, end_date, status, referral_requirement, min_referrals, max_referrals, referral_bonus, bonus_multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [prizeDescription, photoFileId || null, videoFileId || null, winnersCount, endDate.toISOString(), RaffleStatus.ACTIVE, referralRequirement, minReferrals, maxReferrals, referralBonus || null, bonusMultiplier]
    );

    const raffleId = result.lastID;

    // Связываем розыгрыш с каналами
    for (const channelId of channelIds) {
      await this.db.run(
        'INSERT INTO raffle_channels (raffle_id, channel_id) VALUES (?, ?)',
        [raffleId, channelId]
      );
    }

    return {
      id: raffleId,
      prize_description: prizeDescription,
      photo_file_id: photoFileId,
      video_file_id: videoFileId,
      winners_count: winnersCount,
      end_date: endDate,
      status: RaffleStatus.ACTIVE,
      referral_requirement: referralRequirement,
      min_referrals: minReferrals,
      max_referrals: maxReferrals,
      referral_bonus: referralBonus,
      bonus_multiplier: bonusMultiplier,
      created_at: new Date()
    };
  }

  async getRaffleById(id: number): Promise<Raffle | undefined> {
    const raffle = await this.db.get<any>('SELECT * FROM raffles WHERE id = ?', [id]);
    if (!raffle) return undefined;

    return {
      ...raffle,
      end_date: new Date(raffle.end_date),
      created_at: new Date(raffle.created_at)
    };
  }

  async getAllRaffles(): Promise<Raffle[]> {
    const raffles = await this.db.all<any>('SELECT * FROM raffles ORDER BY created_at DESC');
    return raffles.map(raffle => ({
      ...raffle,
      end_date: new Date(raffle.end_date),
      created_at: new Date(raffle.created_at)
    }));
  }

  async getRafflesByStatus(status: RaffleStatus): Promise<Raffle[]> {
    const raffles = await this.db.all<any>(
      'SELECT * FROM raffles WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
    return raffles.map(raffle => ({
      ...raffle,
      end_date: new Date(raffle.end_date),
      created_at: new Date(raffle.created_at)
    }));
  }

  async getActiveRaffles(): Promise<Raffle[]> {
    return this.getRafflesByStatus(RaffleStatus.ACTIVE);
  }

  async updateRaffleStatus(id: number, status: RaffleStatus): Promise<void> {
    await this.db.run('UPDATE raffles SET status = ? WHERE id = ?', [status, id]);
  }

  async addParticipant(userId: number, raffleId: number, isEligible: boolean): Promise<void> {
    console.log(`📝 Добавляем участника: userId=${userId}, raffleId=${raffleId}, isEligible=${isEligible}`);
    await this.db.run(
      'INSERT OR REPLACE INTO participants (user_id, raffle_id, is_eligible) VALUES (?, ?, ?)',
      [userId, raffleId, isEligible]
    );
    console.log(`✅ Участник добавлен в базу данных`);
  }

  async getParticipantsByRaffleId(raffleId: number): Promise<Participant[]> {
    const participants = await this.db.all<any>(
      'SELECT * FROM participants WHERE raffle_id = ?',
      [raffleId]
    );
    return participants.map(p => ({
      ...p,
      participated_at: new Date(p.participated_at)
    }));
  }

  async getEligibleParticipants(raffleId: number): Promise<Participant[]> {
    const participants = await this.db.all<any>(
      'SELECT * FROM participants WHERE raffle_id = ? AND is_eligible = TRUE',
      [raffleId]
    );
    return participants.map(p => ({
      ...p,
      participated_at: new Date(p.participated_at)
    }));
  }

  async addWinner(raffleId: number, userId: number, prizeWon?: string): Promise<void> {
    await this.db.run(
      'INSERT INTO winners (raffle_id, user_id, prize_won) VALUES (?, ?, ?)',
      [raffleId, userId, prizeWon]
    );
  }

  async getWinnersByRaffleId(raffleId: number): Promise<Winner[]> {
    const winners = await this.db.all<any>(
      'SELECT * FROM winners WHERE raffle_id = ?',
      [raffleId]
    );
    return winners.map(w => ({
      ...w,
      won_at: new Date(w.won_at)
    }));
  }

  async getExpiredRaffles(): Promise<Raffle[]> {
    const now = new Date().toISOString();
    const raffles = await this.db.all<any>(
      'SELECT * FROM raffles WHERE status = ? AND end_date <= ?',
      [RaffleStatus.ACTIVE, now]
    );
    return raffles.map(raffle => ({
      ...raffle,
      end_date: new Date(raffle.end_date),
      created_at: new Date(raffle.created_at)
    }));
  }

  async getUserParticipatedRaffles(userId: number): Promise<Raffle[]> {
    console.log(`🔍 Ищем участия для пользователя userId=${userId}`);
    const raffles = await this.db.all<any>(
      `SELECT r.* FROM raffles r 
       JOIN participants p ON r.id = p.raffle_id 
       WHERE p.user_id = ? AND p.is_eligible = 1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    console.log(`📊 Найдено ${raffles.length} розыгрышей для пользователя ${userId}`);
    return raffles.map(raffle => ({
      ...raffle,
      end_date: new Date(raffle.end_date),
      created_at: new Date(raffle.created_at)
    }));
  }

  async isUserParticipating(userId: number, raffleId: number): Promise<boolean> {
    const participant = await this.db.get<any>(
      'SELECT * FROM participants WHERE user_id = ? AND raffle_id = ? AND is_eligible = 1',
      [userId, raffleId]
    );
    return !!participant;
  }

  async getRaffleWithChannels(raffleId: number): Promise<{ raffle: Raffle; channels: any[] } | undefined> {
    const raffle = await this.getRaffleById(raffleId);
    if (!raffle) return undefined;

    const channels = await this.db.all<any>(
      `SELECT c.* FROM channels c 
       JOIN raffle_channels rc ON c.id = rc.channel_id 
       WHERE rc.raffle_id = ?`,
      [raffleId]
    );

    return { raffle, channels };
  }

  async getActiveRafflesWithChannels(): Promise<{ raffle: Raffle; channels: any[] }[]> {
    const raffles = await this.getRafflesByStatus(RaffleStatus.ACTIVE);
    const result = [];

    for (const raffle of raffles) {
      const channels = await this.db.all<any>(
        `SELECT c.* FROM channels c 
         JOIN raffle_channels rc ON c.id = rc.channel_id 
         WHERE rc.raffle_id = ?`,
        [raffle.id]
      );
      result.push({ raffle, channels });
    }

    return result;
  }

  async addChannelToRaffle(raffleId: number, channelId: number): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO raffle_channels (raffle_id, channel_id) VALUES (?, ?)',
      [raffleId, channelId]
    );
  }

  async removeChannelFromRaffle(raffleId: number, channelId: number): Promise<void> {
    await this.db.run(
      'DELETE FROM raffle_channels WHERE raffle_id = ? AND channel_id = ?',
      [raffleId, channelId]
    );
  }

  async deleteRaffle(id: number): Promise<void> {
    // Сначала удаляем связанные записи
    await this.db.run('DELETE FROM raffle_channels WHERE raffle_id = ?', [id]);
    await this.db.run('DELETE FROM participants WHERE raffle_id = ?', [id]);
    await this.db.run('DELETE FROM winners WHERE raffle_id = ?', [id]);
    
    // Затем удаляем сам розыгрыш
    await this.db.run('DELETE FROM raffles WHERE id = ?', [id]);
  }

  // Методы для работы с реферальными требованиями
  async checkUserReferralRequirements(userId: number, raffleId: number): Promise<{
    hasEnoughReferrals: boolean;
    currentReferrals: number;
    requiredReferrals: number;
    maxReferrals: number;
  }> {
    const raffle = await this.getRaffleById(raffleId);
    if (!raffle || !raffle.referral_requirement) {
      return {
        hasEnoughReferrals: true,
        currentReferrals: 0,
        requiredReferrals: 0,
        maxReferrals: 0
      };
    }

    // Получаем количество рефералов пользователя
    const userReferrals = await this.db.get<any>(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND is_active = TRUE',
      [userId]
    );

    const currentReferrals = userReferrals?.count || 0;
    const hasEnoughReferrals = currentReferrals >= raffle.min_referrals;

    return {
      hasEnoughReferrals,
      currentReferrals,
      requiredReferrals: raffle.min_referrals,
      maxReferrals: raffle.max_referrals
    };
  }

  // Расчет множителя шансов на основе количества рефералов
  calculateBonusMultiplier(referralCount: number): number {
    if (referralCount >= 4) return 2.0; // +100% шансов
    if (referralCount >= 3) return 1.75; // +75% шансов
    if (referralCount >= 2) return 1.5; // +50% шансов
    if (referralCount >= 1) return 1.25; // +25% шансов
    return 1.0; // Базовые шансы
  }

  async getRaffleRequirements(raffleId: number): Promise<{
    hasReferralRequirement: boolean;
    minReferrals: number;
    maxReferrals: number;
    referralBonus?: string;
    channels: any[];
  }> {
    const raffle = await this.getRaffleById(raffleId);
    if (!raffle) {
      throw new Error('Розыгрыш не найден');
    }

    const channels = await this.db.all(
      'SELECT c.* FROM channels c JOIN raffle_channels rc ON c.id = rc.channel_id WHERE rc.raffle_id = ?',
      [raffleId]
    );

    return {
      hasReferralRequirement: raffle.referral_requirement,
      minReferrals: raffle.min_referrals,
      maxReferrals: raffle.max_referrals,
      referralBonus: raffle.referral_bonus,
      channels
    };
  }
}