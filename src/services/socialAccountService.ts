import Database from '../database/database.js';
import { SocialAccount, SocialPlatform, RaffleSocialRequirement } from '../types/index.js';

export class SocialAccountService {
  constructor(private db: Database) {}

  // Создание социального аккаунта
  async createSocialAccount(
    platform: SocialPlatform,
    username: string,
    displayName: string,
    profileUrl: string,
    followerCount?: number,
    isVerified: boolean = false
  ): Promise<SocialAccount> {
    const result = await this.db.run(
      'INSERT INTO social_accounts (platform, username, display_name, profile_url, follower_count, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
      [platform, username, displayName, profileUrl, followerCount, isVerified]
    );

    return {
      id: result.lastID!,
      platform,
      username,
      display_name: displayName,
      profile_url: profileUrl,
      follower_count: followerCount,
      is_verified: isVerified,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // Получение социального аккаунта по ID
  async getSocialAccountById(id: number): Promise<SocialAccount | null> {
    const result = await this.db.get<any>(
      'SELECT * FROM social_accounts WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return {
      ...result,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at)
    };
  }

  // Получение социального аккаунта по платформе и username
  async getSocialAccountByUsername(platform: SocialPlatform, username: string): Promise<SocialAccount | null> {
    const result = await this.db.get<any>(
      'SELECT * FROM social_accounts WHERE platform = ? AND username = ?',
      [platform, username]
    );

    if (!result) return null;

    return {
      ...result,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at)
    };
  }

  // Получение всех социальных аккаунтов
  async getAllSocialAccounts(): Promise<SocialAccount[]> {
    const results = await this.db.all<any>(
      'SELECT * FROM social_accounts WHERE is_active = 1 ORDER BY platform, username'
    );

    return results.map(result => ({
      ...result,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at)
    }));
  }

  // Получение социальных аккаунтов по платформе
  async getSocialAccountsByPlatform(platform: SocialPlatform): Promise<SocialAccount[]> {
    const results = await this.db.all<any>(
      'SELECT * FROM social_accounts WHERE platform = ? AND is_active = 1 ORDER BY username',
      [platform]
    );

    return results.map(result => ({
      ...result,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at)
    }));
  }

  // Обновление социального аккаунта
  async updateSocialAccount(
    id: number,
    updates: Partial<Pick<SocialAccount, 'display_name' | 'profile_url' | 'follower_count' | 'is_verified' | 'is_active'>>
  ): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(new Date().toISOString()); // updated_at
    values.push(id);

    await this.db.run(
      `UPDATE social_accounts SET ${fields}, updated_at = ? WHERE id = ?`,
      values
    );
  }

  // Удаление социального аккаунта (мягкое удаление)
  async deleteSocialAccount(id: number): Promise<void> {
    await this.db.run(
      'UPDATE social_accounts SET is_active = 0 WHERE id = ?',
      [id]
    );
  }

  // Добавление требования к социальной сети для розыгрыша
  async addSocialRequirementToRaffle(
    raffleId: number,
    socialAccountId: number,
    requirementType: 'FOLLOW' | 'LIKE' | 'SHARE' | 'COMMENT' = 'FOLLOW'
  ): Promise<RaffleSocialRequirement> {
    const result = await this.db.run(
      'INSERT INTO raffle_social_requirements (raffle_id, social_account_id, requirement_type) VALUES (?, ?, ?)',
      [raffleId, socialAccountId, requirementType]
    );

    return {
      id: result.lastID!,
      raffle_id: raffleId,
      social_account_id: socialAccountId,
      requirement_type: requirementType,
      is_required: true,
      created_at: new Date()
    };
  }

  // Получение требований к социальным сетям для розыгрыша
  async getSocialRequirementsForRaffle(raffleId: number): Promise<(RaffleSocialRequirement & { social_account: SocialAccount })[]> {
    const results = await this.db.all<any>(`
      SELECT rsr.*, sa.*
      FROM raffle_social_requirements rsr
      JOIN social_accounts sa ON rsr.social_account_id = sa.id
      WHERE rsr.raffle_id = ? AND sa.is_active = 1
      ORDER BY sa.platform, sa.username
    `, [raffleId]);

    return results.map(result => ({
      id: result.id,
      raffle_id: result.raffle_id,
      social_account_id: result.social_account_id,
      requirement_type: result.requirement_type,
      is_required: result.is_required,
      created_at: new Date(result.created_at),
      social_account: {
        id: result.social_account_id,
        platform: result.platform,
        username: result.username,
        display_name: result.display_name,
        profile_url: result.profile_url,
        follower_count: result.follower_count,
        is_verified: result.is_verified,
        is_active: result.is_active,
        created_at: new Date(result.created_at),
        updated_at: new Date(result.updated_at)
      }
    }));
  }

  // Удаление требования к социальной сети для розыгрыша
  async removeSocialRequirementFromRaffle(raffleId: number, socialAccountId: number): Promise<void> {
    await this.db.run(
      'DELETE FROM raffle_social_requirements WHERE raffle_id = ? AND social_account_id = ?',
      [raffleId, socialAccountId]
    );
  }

  // Проверка подписки на социальный аккаунт (заглушка - нужно будет реализовать API)
  async checkSocialSubscription(
    platform: SocialPlatform,
    username: string,
    userTelegramId: number
  ): Promise<boolean> {
    // TODO: Реализовать проверку через API социальных сетей
    // Пока возвращаем true для демонстрации
    console.log(`🔍 Проверка подписки: ${platform} @${username} для пользователя ${userTelegramId}`);
    return true;
  }

  // Получение статистики по социальным аккаунтам
  async getSocialAccountsStats(): Promise<{
    totalAccounts: number;
    accountsByPlatform: { platform: string; count: number }[];
    totalFollowers: number;
    verifiedAccounts: number;
  }> {
    const totalAccounts = await this.db.get<any>(
      'SELECT COUNT(*) as count FROM social_accounts WHERE is_active = 1'
    );

    const accountsByPlatform = await this.db.all<any>(`
      SELECT platform, COUNT(*) as count 
      FROM social_accounts 
      WHERE is_active = 1 
      GROUP BY platform
    `);

    const totalFollowers = await this.db.get<any>(
      'SELECT SUM(follower_count) as total FROM social_accounts WHERE is_active = 1 AND follower_count IS NOT NULL'
    );

    const verifiedAccounts = await this.db.get<any>(
      'SELECT COUNT(*) as count FROM social_accounts WHERE is_active = 1 AND is_verified = 1'
    );

    return {
      totalAccounts: totalAccounts?.count || 0,
      accountsByPlatform: accountsByPlatform || [],
      totalFollowers: totalFollowers?.total || 0,
      verifiedAccounts: verifiedAccounts?.count || 0
    };
  }
} 