// Domain groups used by the background request blocker.
const DOMAIN_GROUPS = {
  social: [
    // Occidentales / Globales
    "facebook.com", "www.facebook.com",
    "instagram.com", "www.instagram.com",
    "twitter.com", "x.com", "www.x.com",
    "reddit.com", "www.reddit.com",
    "tiktok.com", "www.tiktok.com",
    "snapchat.com", "www.snapchat.com",
    "pinterest.com", "www.pinterest.com",
    "threads.net", "www.threads.net",
    "tumblr.com", "www.tumblr.com",
    "discord.com", "www.discord.com",

    // Rusas
    "vk.com", "www.vk.com", "m.vk.com", // VKontakte
    "ok.ru", "www.ok.ru", "odnoklassniki.ru", // Odnoklassniki
    "dzen.ru", "www.dzen.ru", // Yandex Zen / Dzen
    "telegram.org", "web.telegram.org", "t.me", // Telegram
    "livejournal.com", "www.livejournal.com", // LiveJournal
    "my.mail.ru", // Moi Mir

    // Chinas
    "weibo.com", "www.weibo.com", "m.weibo.cn", // Sina Weibo
    "wechat.com", "www.wechat.com", "wx.qq.com", // WeChat
    "qq.com", "www.qq.com", "qzone.qq.com", // QQ / Qzone
    "xiaohongshu.com", "www.xiaohongshu.com", // Xiaohongshu (Little Red Book)
    "douban.com", "www.douban.com", // Douban
    "zhihu.com", "www.zhihu.com", // Zhihu
    "tieba.baidu.com" // Baidu Tieba
  ],
  youtube: [
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"
  ],
  gambling: [],
  adult: [
    "pornhub.com",
    "xvideos.com",
    "xnxx.com",
    "onlyfans.com"
  ],
  videoPlatforms: [
    // Globales y Clásicas
    "tiktok.com", "www.tiktok.com",
    "vimeo.com", "www.vimeo.com",
    "dailymotion.com", "www.dailymotion.com",
    "rumble.com", "www.rumble.com",
    "metacafe.com", "www.metacafe.com",
    "veoh.com", "www.veoh.com",
    "bitchute.com", "www.bitchute.com",
    "odysee.com", "www.odysee.com",
    "9gag.com", "www.9gag.com",
    "imgur.com", "www.imgur.com",
    "kwai.com", "www.kwai.com", // Versión global de Kuaishou
    "likee.video", "www.likee.video", // Videos cortos (Singapur/Global)
    "triller.co", "www.triller.co", // Videos cortos / música
    "coub.com", "www.coub.com", // Loops cortos
    "ted.com", "www.ted.com", // Charlas en video
    "archive.org", "www.archive.org", // Internet Archive (películas/videos)

    // Descentralizadas / Web3 / Alternativas
    "lbry.tv", "www.lbry.tv",
    "peertube.tv", "joinpeertube.org", // Red federada PeerTube
    "dtube.video", "d.tube", // DTube
    "brighteon.com", "www.brighteon.com",
    "gab.com", "tv.gab.com",
    "banned.video", "www.banned.video",

    // Japón y Corea del Sur
    "nicovideo.jp", "www.nicovideo.jp", "sp.nicovideo.jp", // Niconico (Japón)
    "fc2.com", "video.fc2.com", // FC2 Video (Japón)
    "abema.tv", "www.abema.tv", // Abema (Japón)
    "tver.jp", "www.tver.jp", // TVer (Japón)
    "afreecatv.com", "www.afreecatv.com", "sooplive.co.kr", // AfreecaTV / SOOP (Corea)
    "tv.naver.com", // Naver TV (Corea)
    "tv.kakao.com", // KakaoTV (Corea)
    "pandora.tv", "www.pandora.tv", // Pandora TV (Corea)

    // India y Sur de Asia
    "mojapp.in", "www.mojapp.in", // Moj (alternativa india a TikTok)
    "sharechat.com", "www.sharechat.com", // ShareChat
    "josh.in", "myjosh.in", // Josh
    "chingari.io", "www.chingari.io", // Chingari
    "mxplayer.in", "www.mxplayer.in", // MX Player
    "jiocinema.com", "www.jiocinema.com", // JioCinema

    // Europa y Medio Oriente
    "arte.tv", "www.arte.tv", // Arte (Francia/Alemania)
    "ina.fr", "www.ina.fr", // Archivo audiovisual francés
    "mediathekviewweb.de", // Mediatecas públicas alemanas
    "shahid.mbc.net", // Shahid (Medio Oriente / Árabe)
    "izlesene.com", "www.izlesene.com", // Izlesene (Turquía)
    "alkass.net", // Deportes/Video Medio Oriente

    // Rusas y Europa del Este (Video)
    "rutube.ru", "www.rutube.ru", // Rutube
    "vkvideo.ru", "www.vkvideo.ru", // VK Video
    "vk.com", "www.vk.com", // VK
    "yandex.ru", // Yandex Video
    "ok.ru", "www.ok.ru", // Odnoklassniki
    "coub.com", // Muy popular en Rusia/Europa del Este
    "mover.uz", "www.mover.uz", // Uzbekistán / Asia Central
    "kiwi.kz", // Kazajistán
    "cda.pl", "www.cda.pl", // CDA (Polonia - muy usado para películas/videos)
    "videa.hu", "www.videa.hu", // Videa (Hungría)

    // Chinas y Sudeste Asiático (Video corto y largo)
    "douyin.com", "www.douyin.com", // TikTok original chino
    "bilibili.com", "www.bilibili.com", // Bilibili
    "bilibili.tv", "www.bilibili.tv", // Bilibili Internacional
    "kuaishou.com", "www.kuaishou.com", // Kuaishou
    "youku.com", "www.youku.com", // Youku
    "iqiyi.com", "www.iqiyi.com", "iq.com", // iQIYI
    "v.qq.com", "wetv.vip", // Tencent Video / WeTV (internacional)
    "tudou.com", "www.tudou.com", // Tudou
    "acfun.cn", "www.acfun.cn", // AcFun
    "ixigua.com", "www.ixigua.com", // Xigua Video
    "mgtv.com", "www.mgtv.com", // Mango TV
    "sohu.com", "tv.sohu.com", // Sohu Video
    "le.com", "www.le.com", // LeTV / Le.com
    "pptv.com", "www.pptv.com", // PPTV
    "vidio.com", "www.vidio.com" // Vidio (Indonesia)
  ],
  streamingPlatforms: [
    "netflix.com",
    "twitch.tv",
    "kick.com",
    "primevideo.com",
    "disneyplus.com",
    "max.com"
  ],
  custom: []
};

// Kept for compatibility with older pages that import this file.
const DOMAINS = DOMAIN_GROUPS;