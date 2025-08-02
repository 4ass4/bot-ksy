import Database from '../database/database.js';
export interface OfficialChannel {
    id: number;
    telegram_channel_id: string;
    name: string;
    invite_link: string;
    description?: string;
    created_at: string;
}
export declare class OfficialChannelService {
    private db;
    constructor(db: Database);
    getOfficialChannel(): Promise<OfficialChannel | null>;
    createOfficialChannel(telegramChannelId: string, name: string, inviteLink: string, description?: string): Promise<number>;
    updateOfficialChannel(id: number, telegramChannelId: string, name: string, inviteLink: string, description?: string): Promise<void>;
    deleteOfficialChannel(): Promise<void>;
    hasOfficialChannel(): Promise<boolean>;
}
//# sourceMappingURL=officialChannelService.d.ts.map