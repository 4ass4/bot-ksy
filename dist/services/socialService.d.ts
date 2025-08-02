import Database from '../database/database.js';
import { SocialIntegration, SocialPost, SocialPlatform, PostType } from '../types/index.js';
export declare class SocialService {
    private db;
    constructor(db: Database);
    createIntegration(platform: SocialPlatform, accessToken?: string, refreshToken?: string, userId?: string): Promise<SocialIntegration>;
    getActiveIntegration(platform: SocialPlatform): Promise<SocialIntegration | null>;
    updateIntegration(integrationId: number, accessToken?: string, refreshToken?: string, isActive?: boolean): Promise<void>;
    createPost(platform: SocialPlatform, postType: PostType, content?: string, mediaFileId?: string, raffleId?: number, scheduledAt?: Date): Promise<SocialPost>;
    getPostsByStatus(status: string, platform?: SocialPlatform): Promise<SocialPost[]>;
    updatePostStatus(postId: number, status: string, externalPostId?: string): Promise<void>;
    generateRafflePostContent(raffle: any, channels: any[]): string;
    generateWinnerPostContent(winner: any, raffle: any): string;
    publishToTelegram(post: SocialPost, bot: any): Promise<boolean>;
    private getOfficialChannel;
    schedulePost(platform: SocialPlatform, postType: PostType, content: string, scheduledAt: Date, mediaFileId?: string, raffleId?: number): Promise<SocialPost>;
    getPostStats(): Promise<{
        totalPosts: number;
        publishedPosts: number;
        failedPosts: number;
        scheduledPosts: number;
        postsByPlatform: Array<{
            platform: string;
            count: number;
        }>;
    }>;
}
//# sourceMappingURL=socialService.d.ts.map