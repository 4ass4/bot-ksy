export class SocialService {
    db;
    constructor(db) {
        this.db = db;
    }
    // Создание интеграции с платформой
    async createIntegration(platform, accessToken, refreshToken, userId) {
        const result = await this.db.run(`
      INSERT INTO social_integrations (platform, access_token, refresh_token, user_id)
      VALUES (?, ?, ?, ?)
    `, [platform, accessToken, refreshToken, userId]);
        return {
            id: result.lastID,
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
    async getActiveIntegration(platform) {
        const result = await this.db.get(`
      SELECT * FROM social_integrations 
      WHERE platform = ? AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `, [platform]);
        if (!result)
            return null;
        return {
            ...result,
            created_at: new Date(result.created_at),
            updated_at: new Date(result.updated_at)
        };
    }
    // Обновление интеграции
    async updateIntegration(integrationId, accessToken, refreshToken, isActive) {
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
    async createPost(platform, postType, content, mediaFileId, raffleId, scheduledAt) {
        const status = scheduledAt ? 'SCHEDULED' : 'DRAFT';
        const result = await this.db.run(`
      INSERT INTO social_posts (platform, post_type, content, media_file_id, raffle_id, status, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [platform, postType, content, mediaFileId, raffleId, status, scheduledAt?.toISOString()]);
        return {
            id: result.lastID,
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
    async getPostsByStatus(status, platform) {
        let query = 'SELECT * FROM social_posts WHERE status = ?';
        const values = [status];
        if (platform) {
            query += ' AND platform = ?';
            values.push(platform);
        }
        query += ' ORDER BY created_at DESC';
        const results = await this.db.all(query, values);
        return results.map(result => ({
            ...result,
            created_at: new Date(result.created_at),
            scheduled_at: result.scheduled_at ? new Date(result.scheduled_at) : undefined,
            published_at: result.published_at ? new Date(result.published_at) : undefined
        }));
    }
    // Обновление статуса поста
    async updatePostStatus(postId, status, externalPostId) {
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
    generateRafflePostContent(raffle, channels) {
        const channelNames = channels.map(c => c.name).join(', ');
        return `🎁 *Новый розыгрыш!*

🏆 Приз: ${raffle.prize_description}
👥 Победителей: ${raffle.winners_count}
⏰ Завершение: ${new Date(raffle.end_date).toLocaleDateString('ru-RU')}

📺 Подпишитесь на каналы: ${channelNames}

🎯 Участвуйте и выигрывайте!`;
    }
    // Генерация контента для поста о победителе
    generateWinnerPostContent(winner, raffle) {
        return `🏆 *Победитель розыгрыша!*

🎁 Приз: ${raffle.prize_description}
👤 Победитель: @${winner.username || winner.first_name}
🎉 Поздравляем!

💡 Следите за новыми розыгрышами!`;
    }
    // Публикация поста в Telegram (встроенная функция)
    async publishToTelegram(post, bot) {
        try {
            if (!post.content)
                return false;
            // Публикуем в официальный канал, если есть
            const officialChannel = await this.getOfficialChannel();
            if (officialChannel) {
                const messageOptions = {
                    parse_mode: 'Markdown'
                };
                if (post.media_file_id) {
                    await bot.api.sendPhoto(officialChannel.telegram_channel_id, post.media_file_id, {
                        caption: post.content,
                        ...messageOptions
                    });
                }
                else {
                    await bot.api.sendMessage(officialChannel.telegram_channel_id, post.content, messageOptions);
                }
                await this.updatePostStatus(post.id, 'PUBLISHED', 'telegram');
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Ошибка при публикации в Telegram:', error);
            await this.updatePostStatus(post.id, 'FAILED');
            return false;
        }
    }
    // Получение официального канала
    async getOfficialChannel() {
        return await this.db.get('SELECT * FROM official_channel LIMIT 1');
    }
    // Планирование постов
    async schedulePost(platform, postType, content, scheduledAt, mediaFileId, raffleId) {
        return await this.createPost(platform, postType, content, mediaFileId, raffleId, scheduledAt);
    }
    // Получение статистики постов
    async getPostStats() {
        const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_posts,
        SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) as published_posts,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_posts,
        SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduled_posts
      FROM social_posts
    `);
        const postsByPlatform = await this.db.all(`
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
//# sourceMappingURL=socialService.js.map