const http = require("http");
const crypto = require("crypto");
const Redis = require("ioredis");

// --- НАЛАШТУВАННЯ ТЕСТУ ---
const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = 4000;
const TARGET_PATH = "/mailgun/inbound";

const TOTAL_REQUESTS = 10000;
const CONCURRENCY = 50;
const MAILGUN_SIGNING_KEY = "07bf3993644fjbff18227a5ced9";

let sentCount = 0;
let completedCount = 0;
let networkErrors = 0; // Лічильник реальних відхилених мережею запитів
let startTime = 0;

const redisClient = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

function generateRandomString(sizeInKb) {
  return crypto.randomBytes((sizeInKb * 1024) / 2).toString("hex");
}

function sendMultipartRequest(payloadFields, customIp) {
  return new Promise((resolve) => {
    const boundary = `----WebKitFormBoundary${crypto.randomBytes(8).toString("hex")}`;
    let body = Buffer.alloc(0);

    Object.keys(payloadFields).forEach((key) => {
      body = Buffer.concat([
        body,
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${payloadFields[key]}\r\n`,
        ),
      ]);
    });
    body = Buffer.concat([body, Buffer.from(`--${boundary}--\r\n`)]);

    const req = http.request(
      {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: TARGET_PATH,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
          "X-Sender-IP": customIp,
        },
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(true)); // Успішно долетіло
      },
    );

    req.on("error", (err) => {
      networkErrors++; // Фіксуємо помилку мережі Windows/WSL
      resolve(false); // Запит не долетів до Express
    });

    req.write(body);
    req.end();
  });
}

async function sendNext() {
  if (sentCount >= TOTAL_REQUESTS) return;

  const id = ++sentCount;
  const rand = Math.random();

  let type = "legitimate";
  if (rand > 0.6 && rand <= 0.9) type = "spam";
  if (rand > 0.9) type = "ddos";

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = crypto.randomBytes(16).toString("hex");
  let signature = crypto
    .createHmac("sha256", MAILGUN_SIGNING_KEY)
    .update(timestamp + token)
    .digest("hex");

  if (type === "ddos" && Math.random() > 0.7) {
    signature = "WRONG_MALICIOUS_SIGNATURE_SH256";
  }

  let fields = {};
  let senderIp = "127.0.0.1";

  if (type === "legitimate") {
    senderIp = `147.67.11.${crypto.randomInt(1, 254)}`;
    fields = {
      recipient: `user_vip_${id}@tempmail.com`,
      sender: `auth-service@secure-bank.eu`,
      subject: `EU Login Password Initialisation #${id}`,
      "body-plain": `Dear user, your critical verification code is: ${crypto.randomInt(100000, 999999)}. Do not share it.`,
      "body-html": `<html><body><h3>Your OTP Token:</h3><b>${crypto.randomInt(100000, 999999)}</b></body></html>`,
      timestamp,
      token,
      signature,
    };
  } else if (type === "spam") {
    senderIp = `47.90.197.${crypto.randomInt(1, 254)}`;
    const bodySizeKb = 120;
    fields = {
      recipient: `spam_user_${id}@tempmail.com`,
      sender: `noreply@member.alibaba.com`,
      subject: `😢 ≤ $9,9! Почти даром | Рекомендации для вас #${id}`,
      "body-plain":
        `Привет, ознакомьтесь с горячими списками товаров. Отписаться можно внизу. ` +
        generateRandomString(1),
      "body-html": `<!DOCTYPE html><html><body><h2>Акция! Распродажа гаджетов! Купон на скидку!</h2><p>${generateRandomString(bodySizeKb)}</p><br/><a href="https://alibaba.com/unsub">Unsubscribe</a></body></html>`,
      timestamp,
      token,
      signature,
    };
  } else if (type === "ddos") {
    senderIp = "66.66.66.66";
    fields = {
      recipient: `victim_${id}@tempmail.com`,
      sender: `noreply@win-casino-jackpot${id}.net`,
      subject: `💥 Выигрыш 5000$ без регистрации и СМС (ID: #${crypto.randomInt(10000, 99999)})`,
      "body-plain":
        "Вам начислен выигрыш! Срочно забери бонус в личном кабинете казино.",
      "body-html": `<html><body><h1>💥 ВАШ АККАУНТ ВЫБРАН! БОНУС КАЗИНО КРИПТА! 💥</h1></body></html>`,
      timestamp,
      token,
      signature,
    };
  }

  await sendMultipartRequest(fields, senderIp);
  handleComplete();
}

function handleComplete() {
  completedCount++;

  if (completedCount % 500 === 0 || completedCount === TOTAL_REQUESTS) {
    console.log(
      `[📊] HTTP Потік: ${completedCount}/${TOTAL_REQUESTS} запитів оброблено тестом (Помилок мережі OS: ${networkErrors}).`,
    );
  }

  if (completedCount < TOTAL_REQUESTS) {
    setTimeout(() => sendNext(), 2); // Невеликий зазор у 2мс, щоб Windows встигала очищати TCP-стек
  } else if (completedCount === TOTAL_REQUESTS) {
    console.log(
      "\n[⏳] Усі HTTP-запити надіслано. Очікуємо повного розвантаження черг BullMQ воркерами...",
    );

    // Точний Polling для BullMQ черг
    const interval = setInterval(async () => {
      // Опитуємо стан обох нових черг (через ZCARD, бо там структура лімітованих джобів)
      const miceWait = (await redisClient.zcard("bull:miceQueue:wait")) || 0;
      const elephantWait =
        (await redisClient.zcard("bull:elephantQueue:wait")) || 0;

      // 2. Для "active" використовуємо HLEN, оскільки BullMQ тримає активні джоби в HASH
      let miceActive = 0;
      let elephantActive = 0;

      try {
        miceActive = await redisClient.hlen("bull:miceQueue:active");
      } catch (e) {
        // Якщо BullMQ ще не створив цей ключ або тип відрізняється, беремо 0
        miceActive = 0;
      }

      try {
        elephantActive = await redisClient.hlen("bull:elephantQueue:active");
      } catch (e) {
        elephantActive = 0;
      }

      const totalWait = miceWait + elephantWait;
      const totalActive = miceActive + elephantActive;

      if (totalWait === 0 && totalActive === 0) {
        clearInterval(interval);

        const endTime = performance.now();
        const totalTimeDurationSec = (endTime - startTime) / 1000;
        const realDelivered = TOTAL_REQUESTS - networkErrors;
        const rps = realDelivered / totalTimeDurationSec;

        console.log(
          "\n=======================================================",
        );
        console.log("🏁 ФІНАЛЬНІ МЕТРИКИ ОПТИМІЗАЦІЇ (BASELINE — ТЕСТ А)");
        console.log(
          `Успішно долетіло до сервера : ${realDelivered} з ${TOTAL_REQUESTS}`,
        );
        console.log(`Втрачено на рівні сокетів OS: ${networkErrors}`);
        console.log(
          `Загальний час виконання    : ${totalTimeDurationSec.toFixed(2)} сек`,
        );
        console.log(
          `Реальний показник RPS      : ${rps.toFixed(2)} листів/сек`,
        );
        console.log(
          "=======================================================\n",
        );

        await redisClient.quit();
        process.exit(0);
      } else {
        process.stdout.write(
          `\r[⏳] Залишилось у чергах BullMQ: ${totalWait} | В обробці воркерами: ${totalActive} ...`,
        );
      }
    }, 300);
  }
}

console.log(`[🚀] Ініціалізація Enterprise-тесту трафіку...`);
console.log(
  `[📊] Загальна кількість запитів: ${TOTAL_REQUESTS} | Потоків паралельності (Concurrency): ${CONCURRENCY}\n`,
);

startTime = performance.now();

for (let i = 0; i < CONCURRENCY; i++) {
  setTimeout(() => sendNext(), i * 15);
}
