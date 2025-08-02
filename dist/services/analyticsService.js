import { AnalyticsEventType } from '../types/index.js';
export class AnalyticsService {
    db;
    constructor(db) {
        this.db = db;
    }
    // Запись события аналитики
    async trackEvent(eventType, userId, raffleId, channelId, referralCode, metadata) {
        await this.db.run(`
      INSERT INTO analytics (event_type, user_id, raffle_id, channel_id, referral_code, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [eventType, userId, raffleId, channelId, referralCode, metadata]);
    }
    // Получение статистики по пользователям
    async getUserStats() {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN DATE(joined_at) = DATE('now') THEN 1 ELSE 0 END) as new_today,
        SUM(CASE WHEN joined_at >= ? THEN 1 ELSE 0 END) as new_week,
        SUM(CASE WHEN joined_at >= ? THEN 1 ELSE 0 END) as new_month
      FROM users
    `, [weekAgo.toISOString(), monthAgo.toISOString()]);
        const activeToday = await this.db.get(`
      SELECT COUNT(DISTINCT user_id) as active_today
      FROM analytics 
      WHERE event_type IN (?, ?, ?) 
      AND DATE(created_at) = DATE('now')
    `, [AnalyticsEventType.USER_JOINED_RAFFLE, AnalyticsEventType.USER_SUBSCRIBED_CHANNEL, AnalyticsEventType.USER_REGISTERED]);
        return {
            totalUsers: stats?.total_users || 0,
            newUsersToday: stats?.new_today || 0,
            newUsersThisWeek: stats?.new_week || 0,
            newUsersThisMonth: stats?.new_month || 0,
            activeUsersToday: activeToday?.active_today || 0
        };
    }
    // Получение статистики по розыгрышам
    async getRaffleStats() {
        const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_raffles,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_raffles,
        SUM(CASE WHEN status = 'FINISHED' THEN 1 ELSE 0 END) as finished_raffles
      FROM raffles
    `);
        const participants = await this.db.get(`
      SELECT COUNT(*) as total_participants
      FROM participants
    `);
        const winners = await this.db.get(`
      SELECT COUNT(*) as total_winners
      FROM winners
    `);
        const avgParticipants = await this.db.get(`
      SELECT AVG(participant_count) as avg_participants
      FROM (
        SELECT raffle_id, COUNT(*) as participant_count
        FROM participants
        GROUP BY raffle_id
      )
    `);
        return {
            totalRaffles: stats?.total_raffles || 0,
            activeRaffles: stats?.active_raffles || 0,
            finishedRaffles: stats?.finished_raffles || 0,
            totalParticipants: participants?.total_participants || 0,
            totalWinners: winners?.total_winners || 0,
            avgParticipantsPerRaffle: Math.round(avgParticipants?.avg_participants || 0)
        };
    }
    // Получение статистики по каналам
    async getChannelStats() {
        const stats = await this.db.get(`
      SELECT COUNT(*) as total_channels
      FROM channels
    `);
        const subscriptions = await this.db.get(`
      SELECT COUNT(*) as total_subscriptions
      FROM analytics
      WHERE event_type = ?
    `, [AnalyticsEventType.USER_SUBSCRIBED_CHANNEL]);
        const avgSubscriptions = await this.db.get(`
      SELECT AVG(subscription_count) as avg_subscriptions
      FROM (
        SELECT channel_id, COUNT(*) as subscription_count
        FROM analytics
        WHERE event_type = ?
        GROUP BY channel_id
      )
    `, [AnalyticsEventType.USER_SUBSCRIBED_CHANNEL]);
        const topChannels = await this.db.all(`
      SELECT c.name, COUNT(*) as subscriptions
      FROM analytics a
      JOIN channels c ON a.channel_id = c.id
      WHERE a.event_type = ?
      GROUP BY a.channel_id, c.name
      ORDER BY subscriptions DESC
      LIMIT 5
    `, [AnalyticsEventType.USER_SUBSCRIBED_CHANNEL]);
        return {
            totalChannels: stats?.total_channels || 0,
            totalSubscriptions: subscriptions?.total_subscriptions || 0,
            avgSubscriptionsPerChannel: Math.round(avgSubscriptions?.avg_subscriptions || 0),
            topChannels: topChannels || []
        };
    }
    // Получение статистики по рефералам
    async getReferralStats() {
        const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_referrals,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_referrals,
        SUM(CASE WHEN bonus_claimed = 1 THEN 1 ELSE 0 END) as bonus_claimed
      FROM referrals
    `);
        const topReferrers = await this.db.all(`
      SELECT u.first_name, COUNT(*) as referrals
      FROM referrals r
      JOIN users u ON r.referrer_id = u.id
      GROUP BY r.referrer_id, u.first_name
      ORDER BY referrals DESC
      LIMIT 5
    `);
        return {
            totalReferrals: stats?.total_referrals || 0,
            activeReferrals: stats?.active_referrals || 0,
            totalBonusClaimed: stats?.bonus_claimed || 0,
            topReferrers: topReferrers || []
        };
    }
    // Получение статистики по времени
    async getTimeStats(days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const registrations = await this.db.all(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM analytics
      WHERE event_type = ? AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [AnalyticsEventType.USER_REGISTERED, startDate.toISOString()]);
        const raffleJoins = await this.db.all(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM analytics
      WHERE event_type = ? AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [AnalyticsEventType.USER_JOINED_RAFFLE, startDate.toISOString()]);
        const channelSubscriptions = await this.db.all(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM analytics
      WHERE event_type = ? AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [AnalyticsEventType.USER_SUBSCRIBED_CHANNEL, startDate.toISOString()]);
        return {
            registrations: registrations || [],
            raffleJoins: raffleJoins || [],
            channelSubscriptions: channelSubscriptions || []
        };
    }
    // Получение конверсии
    async getConversionStats() {
        const stats = await this.db.get(`
      SELECT 
        (SELECT COUNT(DISTINCT user_id) FROM analytics WHERE event_type = ?) as registrations,
        (SELECT COUNT(DISTINCT user_id) FROM analytics WHERE event_type = ?) as raffle_joins,
        (SELECT COUNT(DISTINCT user_id) FROM analytics WHERE event_type = ?) as wins,
        (SELECT COUNT(DISTINCT user_id) FROM analytics WHERE event_type = ?) as subscriptions
    `, [
            AnalyticsEventType.USER_REGISTERED,
            AnalyticsEventType.USER_JOINED_RAFFLE,
            AnalyticsEventType.USER_WON_RAFFLE,
            AnalyticsEventType.USER_SUBSCRIBED_CHANNEL
        ]);
        const registrations = stats?.registrations || 0;
        const raffleJoins = stats?.raffle_joins || 0;
        const wins = stats?.wins || 0;
        const subscriptions = stats?.subscriptions || 0;
        return {
            registrationToRaffleJoin: registrations > 0 ? Math.round((raffleJoins / registrations) * 100) : 0,
            raffleJoinToWin: raffleJoins > 0 ? Math.round((wins / raffleJoins) * 100) : 0,
            registrationToChannelSubscribe: registrations > 0 ? Math.round((subscriptions / registrations) * 100) : 0
        };
    }
}
//# sourceMappingURL=analyticsService.js.map