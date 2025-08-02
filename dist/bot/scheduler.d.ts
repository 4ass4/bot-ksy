import { Bot } from 'grammy';
import { RaffleService } from '../services/raffleService.js';
import { UserService } from '../services/userService.js';
import { MailingService } from '../services/mailingService.js';
import { ReferralService } from '../services/referralService.js';
export declare class Scheduler {
    private bot;
    private raffleService;
    private userService;
    private mailingService;
    private referralService;
    constructor(bot: Bot, raffleService: RaffleService, userService: UserService, mailingService: MailingService, referralService: ReferralService);
    start(): void;
    private checkExpiredRaffles;
    private finishRaffle;
    private sendRaffleResults;
    private notifyWinners;
    private checkScheduledMailings;
    private checkSendingMailings;
    private executeMailing;
}
//# sourceMappingURL=scheduler.d.ts.map