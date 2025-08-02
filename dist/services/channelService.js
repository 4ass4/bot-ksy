export class ChannelService {
    db;
    constructor(db) {
        this.db = db;
    }
    async createChannel(telegramChannelId, name, inviteLink) {
        const result = await this.db.run('INSERT INTO channels (telegram_channel_id, name, invite_link) VALUES (?, ?, ?)', [telegramChannelId, name, inviteLink]);
        return {
            id: result.lastID,
            telegram_channel_id: telegramChannelId,
            name: name,
            invite_link: inviteLink
        };
    }
    async getAllChannels() {
        return await this.db.all('SELECT * FROM channels ORDER BY name');
    }
    async getChannelById(id) {
        return await this.db.get('SELECT * FROM channels WHERE id = ?', [id]);
    }
    async updateChannel(id, name, inviteLink) {
        await this.db.run('UPDATE channels SET name = ?, invite_link = ? WHERE id = ?', [name, inviteLink, id]);
    }
    async deleteChannel(id) {
        await this.db.run('DELETE FROM channels WHERE id = ?', [id]);
    }
    async getChannelsByRaffleId(raffleId) {
        return await this.db.all(`SELECT c.* FROM channels c 
       JOIN raffle_channels rc ON c.id = rc.channel_id 
       WHERE rc.raffle_id = ?`, [raffleId]);
    }
}
//# sourceMappingURL=channelService.js.map