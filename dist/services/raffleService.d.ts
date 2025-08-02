import Database from '../database/database.js';
import { Raffle, RaffleStatus, Participant, Winner } from '../types/index.js';
export declare class RaffleService {
    private db;
    constructor(db: Database);
    createRaffle(prizeDescription: string, winnersCount: number, endDate: Date, channelIds: number[], photoFileId?: string, videoFileId?: string, referralRequirement?: boolean, minReferrals?: number, maxReferrals?: number, referralBonus?: string, bonusMultiplier?: number): Promise<Raffle>;
    getRaffleById(id: number): Promise<Raffle | undefined>;
    getAllRaffles(): Promise<Raffle[]>;
    getRafflesByStatus(status: RaffleStatus): Promise<Raffle[]>;
    getActiveRaffles(): Promise<Raffle[]>;
    updateRaffleStatus(id: number, status: RaffleStatus): Promise<void>;
    addParticipant(userId: number, raffleId: number, isEligible: boolean): Promise<void>;
    getParticipantsByRaffleId(raffleId: number): Promise<Participant[]>;
    getEligibleParticipants(raffleId: number): Promise<Participant[]>;
    addWinner(raffleId: number, userId: number, prizeWon?: string): Promise<void>;
    getWinnersByRaffleId(raffleId: number): Promise<Winner[]>;
    getExpiredRaffles(): Promise<Raffle[]>;
    getUserParticipatedRaffles(userId: number): Promise<Raffle[]>;
    isUserParticipating(userId: number, raffleId: number): Promise<boolean>;
    getRaffleWithChannels(raffleId: number): Promise<{
        raffle: Raffle;
        channels: any[];
    } | undefined>;
    getActiveRafflesWithChannels(): Promise<{
        raffle: Raffle;
        channels: any[];
    }[]>;
    addChannelToRaffle(raffleId: number, channelId: number): Promise<void>;
    removeChannelFromRaffle(raffleId: number, channelId: number): Promise<void>;
    deleteRaffle(id: number): Promise<void>;
    checkUserReferralRequirements(userId: number, raffleId: number): Promise<{
        hasEnoughReferrals: boolean;
        currentReferrals: number;
        requiredReferrals: number;
        maxReferrals: number;
    }>;
    calculateBonusMultiplier(referralCount: number): number;
    getRaffleRequirements(raffleId: number): Promise<{
        hasReferralRequirement: boolean;
        minReferrals: number;
        maxReferrals: number;
        referralBonus?: string;
        channels: any[];
    }>;
}
//# sourceMappingURL=raffleService.d.ts.map