import Database from '../database/database.js';
import { Referral, ReferralCode } from '../types/index.js';
export declare class ReferralService {
    private db;
    constructor(db: Database);
    private generateReferralCode;
    createReferralCode(userId: number): Promise<ReferralCode>;
    isCodeExists(code: string): Promise<boolean>;
    getReferralCode(userId: number): Promise<ReferralCode | null>;
    getOrCreateReferralCode(userId: number): Promise<ReferralCode>;
    processReferralCode(userId: string, newUserId: number): Promise<boolean>;
    getUserReferralStats(userId: number): Promise<{
        totalReferrals: number;
        activeReferrals: number;
        bonusClaimed: number;
        referralCode: string;
    }>;
    getUserReferrals(userId: number): Promise<Referral[]>;
    claimReferralBonus(referralId: number): Promise<void>;
    getReferralLink(userId: number): string;
    processStartParameter(startParam: string, userId: number): Promise<boolean>;
    private checkAndAutoEnrollInRaffles;
    checkUserReferralRequirements(userId: number, raffleId: number): Promise<{
        hasEnoughReferrals: boolean;
        currentReferrals: number;
        requiredReferrals: number;
    }>;
}
//# sourceMappingURL=referralService.d.ts.map