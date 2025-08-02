import Database from '../database/database.js';
import { Mailing, MailingType, MailingStatus } from '../types/index.js';
export declare class MailingService {
    private db;
    constructor(db: Database);
    createMailing(mailingType: MailingType, messageText: string, targetRaffleId?: number, photoFileId?: string, videoFileId?: string, inlineKeyboardJson?: string, scheduleTime?: Date): Promise<Mailing>;
    getAllMailings(): Promise<Mailing[]>;
    getScheduledMailings(): Promise<Mailing[]>;
    getSendingMailings(): Promise<Mailing[]>;
    updateMailingStatus(id: number, status: MailingStatus): Promise<void>;
    updateMailingStats(id: number, sentCount: number, failedCount: number): Promise<void>;
    cancelMailing(id: number): Promise<void>;
    deleteMailing(id: number): Promise<void>;
    getMailingById(id: number): Promise<Mailing | null>;
}
//# sourceMappingURL=mailingService.d.ts.map