import Database from '../database/database.js';
import { AnalyticsEventType } from '../types/index.js';
export declare class AnalyticsService {
    private db;
    constructor(db: Database);
    trackEvent(eventType: AnalyticsEventType, userId?: number, raffleId?: number, channelId?: number, referralCode?: string, metadata?: string): Promise<void>;
    getUserStats(): Promise<{
        totalUsers: number;
        newUsersToday: number;
        newUsersThisWeek: number;
        newUsersThisMonth: number;
        activeUsersToday: number;
    }>;
    getRaffleStats(): Promise<{
        totalRaffles: number;
        activeRaffles: number;
        finishedRaffles: number;
        totalParticipants: number;
        totalWinners: number;
        avgParticipantsPerRaffle: number;
    }>;
    getChannelStats(): Promise<{
        totalChannels: number;
        totalSubscriptions: number;
        avgSubscriptionsPerChannel: number;
        topChannels: Array<{
            name: string;
            subscriptions: number;
        }>;
    }>;
    getReferralStats(): Promise<{
        totalReferrals: number;
        activeReferrals: number;
        totalBonusClaimed: number;
        topReferrers: Array<{
            name: string;
            referrals: number;
        }>;
    }>;
    getTimeStats(days?: number): Promise<{
        registrations: Array<{
            date: string;
            count: number;
        }>;
        raffleJoins: Array<{
            date: string;
            count: number;
        }>;
        channelSubscriptions: Array<{
            date: string;
            count: number;
        }>;
    }>;
    getConversionStats(): Promise<{
        registrationToRaffleJoin: number;
        raffleJoinToWin: number;
        registrationToChannelSubscribe: number;
    }>;
}
//# sourceMappingURL=analyticsService.d.ts.map