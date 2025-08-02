export var RaffleStatus;
(function (RaffleStatus) {
    RaffleStatus["SCHEDULED"] = "SCHEDULED";
    RaffleStatus["ACTIVE"] = "ACTIVE";
    RaffleStatus["FINISHED"] = "FINISHED";
    RaffleStatus["CANCELED"] = "CANCELED";
})(RaffleStatus || (RaffleStatus = {}));
export var MailingType;
(function (MailingType) {
    MailingType["ALL_USERS"] = "ALL_USERS";
    MailingType["RAFFLE_PARTICIPANTS"] = "RAFFLE_PARTICIPANTS";
})(MailingType || (MailingType = {}));
export var MailingStatus;
(function (MailingStatus) {
    MailingStatus["SCHEDULED"] = "SCHEDULED";
    MailingStatus["SENDING"] = "SENDING";
    MailingStatus["COMPLETED"] = "COMPLETED";
    MailingStatus["CANCELED"] = "CANCELED";
})(MailingStatus || (MailingStatus = {}));
export var AnalyticsEventType;
(function (AnalyticsEventType) {
    AnalyticsEventType["USER_REGISTERED"] = "USER_REGISTERED";
    AnalyticsEventType["USER_JOINED_RAFFLE"] = "USER_JOINED_RAFFLE";
    AnalyticsEventType["USER_WON_RAFFLE"] = "USER_WON_RAFFLE";
    AnalyticsEventType["USER_SUBSCRIBED_CHANNEL"] = "USER_SUBSCRIBED_CHANNEL";
    AnalyticsEventType["REFERRAL_CREATED"] = "REFERRAL_CREATED";
    AnalyticsEventType["REFERRAL_BONUS_CLAIMED"] = "REFERRAL_BONUS_CLAIMED";
    AnalyticsEventType["RAFFLE_CREATED"] = "RAFFLE_CREATED";
    AnalyticsEventType["RAFFLE_FINISHED"] = "RAFFLE_FINISHED";
    AnalyticsEventType["SOCIAL_POST_PUBLISHED"] = "SOCIAL_POST_PUBLISHED";
})(AnalyticsEventType || (AnalyticsEventType = {}));
export var SocialPlatform;
(function (SocialPlatform) {
    SocialPlatform["TELEGRAM"] = "TELEGRAM";
    SocialPlatform["INSTAGRAM"] = "INSTAGRAM";
    SocialPlatform["TIKTOK"] = "TIKTOK";
    SocialPlatform["TWITTER"] = "TWITTER";
    SocialPlatform["FACEBOOK"] = "FACEBOOK";
    SocialPlatform["YOUTUBE"] = "YOUTUBE";
})(SocialPlatform || (SocialPlatform = {}));
export var PostType;
(function (PostType) {
    PostType["RAFFLE_ANNOUNCEMENT"] = "RAFFLE_ANNOUNCEMENT";
    PostType["WINNER_ANNOUNCEMENT"] = "WINNER_ANNOUNCEMENT";
    PostType["CHANNEL_PROMOTION"] = "CHANNEL_PROMOTION";
    PostType["GENERAL_PROMOTION"] = "GENERAL_PROMOTION";
})(PostType || (PostType = {}));
//# sourceMappingURL=index.js.map