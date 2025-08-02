export interface User {
    id: number;
    telegram_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    is_admin: boolean;
    joined_at: Date;
}
export interface Channel {
    id: number;
    telegram_channel_id: string;
    name: string;
    invite_link: string;
}
export declare enum RaffleStatus {
    SCHEDULED = "SCHEDULED",
    ACTIVE = "ACTIVE",
    FINISHED = "FINISHED",
    CANCELED = "CANCELED"
}
export interface Raffle {
    id: number;
    prize_description: string;
    photo_file_id?: string;
    video_file_id?: string;
    winners_count: number;
    end_date: Date;
    status: RaffleStatus;
    result_message_id?: number;
    referral_requirement: boolean;
    min_referrals: number;
    max_referrals: number;
    referral_bonus?: string;
    bonus_multiplier: number;
    created_at: Date;
}
export interface RaffleChannel {
    raffle_id: number;
    channel_id: number;
}
export interface Participant {
    id: number;
    user_id: number;
    raffle_id: number;
    is_eligible: boolean;
    participated_at: Date;
}
export interface Winner {
    id: number;
    raffle_id: number;
    user_id: number;
    prize_won?: string;
    won_at: Date;
}
export declare enum MailingType {
    ALL_USERS = "ALL_USERS",
    RAFFLE_PARTICIPANTS = "RAFFLE_PARTICIPANTS"
}
export declare enum MailingStatus {
    SCHEDULED = "SCHEDULED",
    SENDING = "SENDING",
    COMPLETED = "COMPLETED",
    CANCELED = "CANCELED"
}
export interface Mailing {
    id: number;
    mailing_type: MailingType;
    target_raffle_id?: number;
    message_text: string;
    photo_file_id?: string;
    video_file_id?: string;
    inline_keyboard_json?: string;
    schedule_time?: Date;
    status: MailingStatus;
    sent_count: number;
    failed_count: number;
    created_at: Date;
}
export interface BotContext {
    userId: number;
    isAdmin: boolean;
    currentStep?: string;
    tempData?: any;
}
export interface BotSettings {
    id: number;
    welcome_message: string;
    cover_photo_file_id?: string;
    updated_at: Date;
}
export interface Referral {
    id: number;
    referrer_id: number;
    referred_id: number;
    referral_code: string;
    is_active: boolean;
    bonus_claimed: boolean;
    created_at: Date;
    first_name?: string;
    username?: string;
}
export interface ReferralCode {
    id: number;
    user_id: number;
    code: string;
    usage_count: number;
    max_usage: number;
    is_active: boolean;
    created_at: Date;
}
export interface Analytics {
    id: number;
    event_type: string;
    user_id?: number;
    raffle_id?: number;
    channel_id?: number;
    referral_code?: string;
    metadata?: string;
    created_at: Date;
}
export interface SocialIntegration {
    id: number;
    platform: string;
    access_token?: string;
    refresh_token?: string;
    user_id?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface SocialPost {
    id: number;
    platform: string;
    post_type: string;
    content?: string;
    media_file_id?: string;
    raffle_id?: number;
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
    scheduled_at?: Date;
    published_at?: Date;
    external_post_id?: string;
    created_at: Date;
}
export declare enum AnalyticsEventType {
    USER_REGISTERED = "USER_REGISTERED",
    USER_JOINED_RAFFLE = "USER_JOINED_RAFFLE",
    USER_WON_RAFFLE = "USER_WON_RAFFLE",
    USER_SUBSCRIBED_CHANNEL = "USER_SUBSCRIBED_CHANNEL",
    REFERRAL_CREATED = "REFERRAL_CREATED",
    REFERRAL_BONUS_CLAIMED = "REFERRAL_BONUS_CLAIMED",
    RAFFLE_CREATED = "RAFFLE_CREATED",
    RAFFLE_FINISHED = "RAFFLE_FINISHED",
    SOCIAL_POST_PUBLISHED = "SOCIAL_POST_PUBLISHED"
}
export declare enum SocialPlatform {
    TELEGRAM = "TELEGRAM",
    INSTAGRAM = "INSTAGRAM",
    TIKTOK = "TIKTOK",
    TWITTER = "TWITTER",
    FACEBOOK = "FACEBOOK",
    YOUTUBE = "YOUTUBE"
}
export interface SocialAccount {
    id: number;
    platform: SocialPlatform;
    username: string;
    display_name: string;
    profile_url: string;
    follower_count?: number;
    is_verified: boolean;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface RaffleSocialRequirement {
    id: number;
    raffle_id: number;
    social_account_id: number;
    requirement_type: 'FOLLOW' | 'LIKE' | 'SHARE' | 'COMMENT';
    is_required: boolean;
    created_at: Date;
}
export declare enum PostType {
    RAFFLE_ANNOUNCEMENT = "RAFFLE_ANNOUNCEMENT",
    WINNER_ANNOUNCEMENT = "WINNER_ANNOUNCEMENT",
    CHANNEL_PROMOTION = "CHANNEL_PROMOTION",
    GENERAL_PROMOTION = "GENERAL_PROMOTION"
}
//# sourceMappingURL=index.d.ts.map