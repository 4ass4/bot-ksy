import Database from '../database/database.js';
import { SocialAccount, SocialPlatform, RaffleSocialRequirement } from '../types/index.js';
export declare class SocialAccountService {
    private db;
    constructor(db: Database);
    createSocialAccount(platform: SocialPlatform, username: string, displayName: string, profileUrl: string, followerCount?: number, isVerified?: boolean): Promise<SocialAccount>;
    getSocialAccountById(id: number): Promise<SocialAccount | null>;
    getSocialAccountByUsername(platform: SocialPlatform, username: string): Promise<SocialAccount | null>;
    getAllSocialAccounts(): Promise<SocialAccount[]>;
    getSocialAccountsByPlatform(platform: SocialPlatform): Promise<SocialAccount[]>;
    updateSocialAccount(id: number, updates: Partial<Pick<SocialAccount, 'display_name' | 'profile_url' | 'follower_count' | 'is_verified' | 'is_active'>>): Promise<void>;
    deleteSocialAccount(id: number): Promise<void>;
    addSocialRequirementToRaffle(raffleId: number, socialAccountId: number, requirementType?: 'FOLLOW' | 'LIKE' | 'SHARE' | 'COMMENT'): Promise<RaffleSocialRequirement>;
    getSocialRequirementsForRaffle(raffleId: number): Promise<(RaffleSocialRequirement & {
        social_account: SocialAccount;
    })[]>;
    removeSocialRequirementFromRaffle(raffleId: number, socialAccountId: number): Promise<void>;
    checkSocialSubscription(platform: SocialPlatform, username: string, userTelegramId: number): Promise<boolean>;
    getSocialAccountsStats(): Promise<{
        totalAccounts: number;
        accountsByPlatform: {
            platform: string;
            count: number;
        }[];
        totalFollowers: number;
        verifiedAccounts: number;
    }>;
}
//# sourceMappingURL=socialAccountService.d.ts.map