// Domain groups used by the background request blocker.
const DOMAIN_GROUPS = {
  social: [
    "facebook.com", "www.facebook.com", "instagram.com", "www.instagram.com",
    "twitter.com", "x.com", "www.x.com", "reddit.com", "www.reddit.com",
    "tiktok.com", "www.tiktok.com", "snapchat.com", "pinterest.com",
    "linkedin.com", "www.linkedin.com", "threads.net", "www.threads.net"
  ],
  youtube: [
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"
  ],
  gambling: [
    "bet365.com", "www.bet365.com", "draftkings.com", "www.draftkings.com",
    "fanduel.com", "www.fanduel.com", "pokerstars.com", "www.pokerstars.com",
    "888casino.com", "www.888casino.com", "stake.com", "www.stake.com"
  ],
  custom: []
};

// Kept for compatibility with older pages that import this file.
const DOMAINS = DOMAIN_GROUPS;
