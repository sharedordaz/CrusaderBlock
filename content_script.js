const blockedWords = [
  "PORN", "porn", "Porn",
  "THREESOME", "threesome", "Threesome",
  "TRIO", "trio", "Trio",
  "ANAL", "anal", "Anal",
  "FETISH", "fetish", "Fetish",
  "BONDAGE", "bondage", "Bondage",
  "MILF", "milf", "Milf",
  "BDSM", "bdsm", "Bdsm",
  "GANGBANG", "gangbang", "Gangbang",
  "HARDCORE", "hardcore", "Hardcore",
  "LESBIAN", "lesbian", "Lesbian",
  "GAY", "gay", "Gay",
  "STRAIGHT", "straight", "Straight",
  "BISEXUAL", "bisexual", "Bisexual",
  "INTERRACIAL", "interracial", "Interracial",
  "TEEN", "teen", "Teen",
  "AMATEUR", "amateur", "Amateur",
  "MATURE", "mature", "Mature",
  "COUPLE", "couple", "Couple",
  "FANTASY", "fantasy", "Fantasy",
  "ROLEPLAY", "roleplay", "Roleplay",
  "ORGASM", "orgasm", "Orgasm",
  "EROTIC", "erotic", "Erotic",
  "EXPLICIT", "explicit", "Explicit",
  "NAKED", "naked", "Naked",
  "NIPPLE", "nipple", "Nipple",
  "PENETRATION", "penetration", "Penetration",
  "SEDUCTION", "seduction", "Seduction",
  "VOYEUR", "voyeur", "Voyeur",
  "EXHIBITIONISM", "exhibitionism", "Exhibitionism",
  "FANTASIES", "fantasies", "Fantasies",
  "TOYS", "toys", "Toys",
  "ORGY", "orgy", "Orgy",
  "SEXY", "sexy", "Sexy",
  "SEX", "sex", "Sex",
  "KINKY", "kinky", "Kinky",
  "LIBIDO", "libido", "Libido",
  "AROUSAL", "arousal", "Arousal",
  "FOREPLAY", "foreplay", "Foreplay",
  "CLIMAX", "climax", "Climax",
]

const asterisks = "*****";
const asciiBrick = "█████";
const deusVult = "✠ ᴰᵉᵘˢ ⱽᵘˡᵗᵎ ✠";

const censorship = asciiBrick;

// Replaces blocked words with asterisks
document.body.innerHTML = document.body.innerHTML.replace(
  new RegExp(blockedWords.join("|"), "gi"),
  censorship
);
