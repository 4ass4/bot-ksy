import Database from '../database/database.js';
import { SocialIntegration, SocialPost, SocialPlatform, PostType } from '../types/index.js';

export class SocialService {
  constructor(private db: Database) {}

  // Создание интеграции с платформой
  async createIntegration(
    platform: SocialPlatform,
    accessToken?: string,
    refreshToken?: string,
    userId?: string
  ): Promise<SocialIntegration> {
    const result = await this.db.run(`
      INSERT INTO social_integrations (platform, access_token, refresh_token, user_id)
      VALUES (?, ?, ?, ?)
    `, [platform, accessToken, refreshToken, userId]);

    return {
      id: result.lastID!,
      platform,
      access_token: accessToken,
      refresh_token: refreshToken,
      user_id: userId,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // Получение активной интеграции для платформы
  async getActiveIntegration(platform: SocialPlatform): Promise<SocialIntegration | null> {
    const result = await this.db.get<any>(`
      SELECT * FROM social_integrations 
      WHERE platform = ? AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `, [platform]);

    if (!result) return null;

    return {
      ...result,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at)
    };
  }

  // Обновление интеграции
  async updateIntegration(
    integrationId: number,
    accessToken?: string,
    refreshToken?: string,
    isActive?: boolean
  ): Promise<void> {
    const updates = [];
    const values = [];

    if (accessToken !== undefined) {
      updates.push('access_token = ?');
      values.push(accessToken);
    }
    if (refreshToken !== undefined) {
      updates.push('refresh_token = ?');
      values.push(refreshToken);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(integrationId);

    await this.db.run(`
      UPDATE social_integrations 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);
  }

  // Создание поста для публикации
  async createPost(
    platform: SocialPlatform,
    postType: PostType,
    content?: string,
    mediaFileId?: string,
    raffleId?: number,
    scheduledAt?: Date
  ): Promise<SocialPost> {
    const status = scheduledAt ? 'SCHEDULED' : 'DRAFT';
    
    const result = await this.db.run(`
      INSERT INTO social_posts (platform, post_type, content, media_file_id, raffle_id, status, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [platform, postType, content, mediaFileId, raffleId, status, scheduledAt?.toISOString()]);

    return {
      id: result.lastID!,
      platform,
      post_type: postType,
      content,
      media_file_id: mediaFileId,
      raffle_id: raffleId,
      status,
      scheduled_at: scheduledAt,
      created_at: new Date()
    };
  }

  // Получение постов по статусу
  async getPostsByStatus(status: string, platform?: SocialPlatform): Promise<SocialPost[]> {
    let query = 'SELECT * FROM social_posts WHERE status = ?';
    const values = [status];

    if (platform) {
      query += ' AND platform = ?';
      values.push(platform);
    }

    query += ' ORDER BY created_at DESC';

    const results = await this.db.all<any>(query, values);

    return results.map(result => ({
      ...result,
      created_at: new Date(result.created_at),
      scheduled_at: result.scheduled_at ? new Date(result.scheduled_at) : undefined,
      published_at: result.published_at ? new Date(result.published_at) : undefined
    }));
  }

  // Обновление статуса поста
  async updatePostStatus(postId: number, status: string, externalPostId?: string): Promise<void> {
    const updates = ['status = ?'];
    const values = [status];

    if (status === 'PUBLISHED') {
      updates.push('published_at = ?');
      values.push(new Date().toISOString());
    }

    if (externalPostId) {
      updates.push('external_post_id = ?');
      values.push(externalPostId);
    }

    values.push(postId.toString());

    await this.db.run(`
      UPDATE social_posts 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);
  }

  // Генерация контента для поста о розыгрыше
  generateRafflePostContent(raffle: any, channels: any[]): string {
    const channelNames = channels.map(c => c.name).join(', ');
    
    return `🎁 *Новый розыгрыш!*

🏆 Приз: ${raffle.prize_description}
👥 Победителей: ${raffle.winners_count}
⏰ Завершение: ${new Date(raffle.end_date).toLocaleDateString('ru-RU')}

📺 Подпишитесь на каналы: ${channelNames}

🎯 Участвуйте и выигрывайте!`;
  }

  // Генерация контента для поста о победителе
  generateWinnerPostContent(winner: any, raffle: any): string {
    return `🏆 *Победитель розыгрыша!*

🎁 Приз: ${raffle.prize_description}
👤 Победитель: @${winner.username || winner.first_name}
🎉 Поздравляем!

💡 Следите за новыми розыгрышами!`;
  }

  // Публикация поста в Telegram (встроенная функция)
  async publishToTelegram(post: SocialPost, bot: any): Promise<boolean> {
    try {
      if (!post.content) return false;

      // Публикуем в официальный канал, если есть
      const officialChannel = await this.getOfficialChannel();
      if (officialChannel) {
        const messageOptions: any = {
          parse_mode: 'Markdown'
        };

        if (post.media_file_id) {
          await bot.api.sendPhoto(officialChannel.telegram_channel_id, post.media_file_id, {
            caption: post.content,
            ...messageOptions
          });
        } else {
          await bot.api.sendMessage(officialChannel.telegram_channel_id, post.content, messageOptions);
        }

        await this.updatePostStatus(post.id, 'PUBLISHED', 'telegram');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при публикации в Telegram:', error);
      await this.updatePostStatus(post.id, 'FAILED');
      return false;
    }
  }

  // Получение официального канала
  private async getOfficialChannel(): Promise<any> {
    return await this.db.get('SELECT * FROM official_channel LIMIT 1');
  }

  // Планирование постов
  async schedulePost(
    platform: SocialPlatform,
    postType: PostType,
    content: string,
    scheduledAt: Date,
    mediaFileId?: string,
    raffleId?: number
  ): Promise<SocialPost> {
    return await this.createPost(platform, postType, content, mediaFileId, raffleId, scheduledAt);
  }

  // Получение статистики постов
  async getPostStats(): Promise<{
    totalPosts: number;
    publishedPosts: number;
    failedPosts: number;
    scheduledPosts: number;
    postsByPlatform: Array<{ platform: string; count: number }>;
  }> {
    const stats = await this.db.get<any>(`
      SELECT 
        COUNT(*) as total_posts,
        SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) as published_posts,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_posts,
        SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduled_posts
      FROM social_posts
    `);

    const postsByPlatform = await this.db.all<any>(`
      SELECT platform, COUNT(*) as count
      FROM social_posts
      GROUP BY platform
      ORDER BY count DESC
    `);

    return {
      totalPosts: stats?.total_posts || 0,
      publishedPosts: stats?.published_posts || 0,
      failedPosts: stats?.failed_posts || 0,
      scheduledPosts: stats?.scheduled_posts || 0,
      postsByPlatform: postsByPlatform || []
    };
  }
} 