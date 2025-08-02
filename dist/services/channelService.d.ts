import Database from '../database/database.js';
import { Channel } from '../types/index.js';
export declare class ChannelService {
    private db;
    constructor(db: Database);
    createChannel(telegramChannelId: string, name: string, inviteLink: string): Promise<Channel>;
    getAllChannels(): Promise<Channel[]>;
    getChannelById(id: number): Promise<Channel | undefined>;
    updateChannel(id: number, name: string, inviteLink: string): Promise<void>;
    deleteChannel(id: number): Promise<void>;
    getChannelsByRaffleId(raffleId: number): Promise<Channel[]>;
}
//# sourceMappingURL=channelService.d.ts.map