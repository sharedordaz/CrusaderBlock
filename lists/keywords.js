// Keywords are matched as whole phrases, case-insensitively.
const KEYWORDS = {
  // Text matching these entries is replaced with ASCII bricks.
  censor: [
    "profanity", "explicit", "nsfw", "porn", "pornography",
    "casino", "gambling", "betting", "gambling addiction"
  ],
  // Opening or rendering these phrases causes their tab to close.
  closeTab: [
    "pornhub", "xvideos", "onlyfans", "bet365", "stake.com"
  ]
};

// Shared defaults make the arrays available to background and content contexts.
const DEFAULT_DOMAIN_SETTINGS = {
  social: false,
  youtube: false,
  gambling: false,
  custom: false
};
