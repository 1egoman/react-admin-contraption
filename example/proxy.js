const fetch = require('node-fetch');
const app = require('express')();

const cookie = "current-account=AC06b6b8dde473a4c984d80cc04a930e9a; notice_behavior=implied,eu; affinity=\"ec575007a81dbdd8\"; tw-content-language=en-us; _cq_suid=1.1694114609.WrQxTdPShKpWeNKj; at_check=true; check=true; ajs_user_id=USbd3c40756460b7bb14ca7b4d1af6716c; __Secure-authjs.callback-url=https%3A%2F%2Fwww.twilio.com; tw-code-language=Node.js; identity=; __Host-authjs.csrf-token=3993b146ee07015310f5027a638ba6b7b2992f91d60a722735b2cfeb39283601%7C33f7ba901fd2b5d8232784a4c37993a3418768ec3ecba23e664f064eef57f847; server-identity=ZTE=LA==MQ==LA==_MzLi_ZEO3uuXy-DLA==Z5K9tGdfxsHHajTxW2OrY5n3Us0o6YJW_3YCr7xPdkqxpNuQ5D_FU1pAgqKGOXawjwUVrW5r4svFccPyZaY=; tw-visitor=eyJrZXlJZCI6InZpc2l0b3JFbmNyeXB0aW9uS2V5Iiwibm9uY2UiOiJuRVVnTXUvSEhHbzJ4bjgzIiwicGF5bG9hZCI6IkkvOVdUWExMbkJ4UE01U3RCUHpVK0hIWUYwWXlJcnFRdFM3M2hnMm1lSGg3a0VtbWlrT1I2eGozeElTaVNFS1hsb2c9IiwiY3J5cHRvSWQiOjQsImFkZGl0aW9uYWxEYXRhIjoiZEc5aFdWazNkMkpMVG5kQmNFOXJWalp0WjNCUWFrNHpSMVZYVlZSUFRXMD0ifQ==";

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  next();
});

app.get("/console/video/api/logs/rooms/:roomId/participants/:participantId/tracks/metrics", async (req, res) => {
  const response = await fetch(`https://www.twilio.com/console/video/api/logs/rooms/${req.params.roomId}/participants/${req.params.participantId}/tracks/metrics?`, {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9,ca;q=0.8",
      "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      "x-target-region": "us1",
      "x-twilio-csrf": "3047abeaa9aaa8000671540b1980fc0aa6a9a66377c0811d0d9797a62f9331e2",
      "cookie": cookie,
      "Referer": "https://console.twilio.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
  });

  res.status(response.status).send(await response.text());
});

app.get("/console/video/api/logs/rooms/:roomId/participants/:participantId/connection/metrics", async (req, res) => {
  const response = await fetch(`https://www.twilio.com/console/video/api/logs/rooms/${req.params.roomId}/participants/${req.params.participantId}/connection/metrics?`, {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9,ca;q=0.8",
      "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      "x-target-region": "us1",
      "x-twilio-csrf": "3047abeaa9aaa8000671540b1980fc0aa6a9a66377c0811d0d9797a62f9331e2",
      "cookie": cookie,
      "Referer": "https://console.twilio.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
  });

  res.status(response.status).send(await response.text());
});

app.get("/console/video/api/logs/rooms/:roomId/participants", async (req, res) => {
  const response = await fetch(`https://www.twilio.com/console/video/api/logs/rooms/${req.params.roomId}/participants`, {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9,ca;q=0.8",
      "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      "x-twilio-csrf": "3047abeaa9aaa8000671540b1980fc0aa6a9a66377c0811d0d9797a62f9331e2",
      "cookie": cookie,
      "Referer": "https://console.twilio.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
  });

  res.status(response.status).send(await response.text());
});

app.listen(3001);
