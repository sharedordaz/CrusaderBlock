const blockedWords = ["triggerword1", "triggerword2"];

// Replaces blocked words with asterisks
document.body.innerHTML = document.body.innerHTML.replace(
  new RegExp(blockedWords.join("|"), "gi"),
  "***"
);
