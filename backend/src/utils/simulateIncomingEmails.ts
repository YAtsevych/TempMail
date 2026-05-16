import { createEmail } from "../services/emailService"; // Импортируй функцию сохранения письма
import fs from "fs";
import path from "path";
import { simpleParser } from "mailparser";

// Читаем СЫРОЙ текст письма (с заголовками и кракозябрами)

const rawEmailPath = path.join(
  process.cwd(),
  "backend/src/utils/letters/mexc.txt",
);
const rawMexcEmail = fs.readFileSync(rawEmailPath, "utf-8");
// Функция-генератор фейковых писем (7 штук)
export const simulateIncomingEmails = (inboxAddress: string) => {
  const emails = [
    {
      delay: 3000,
      from_address: "welcome@tempmail.dev",
      subject: "Добро пожаловать в TempMail! 🎉",
      body_text:
        "Привет!\n\nТвой врем��нный почтовый ящик успешно создан. Он будет работать 24 часа.\n\nИспользуй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.\n\nКоманда TempMail",
      body_html:
        "<h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p><h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p>",
    },
    {
      delay: 10000,
      from_address: "noreply@github.com",
      subject: "[GitHub] Please verify your device",
      body_text:
        "Hey Developer!\n\nA sign in attempt requires further verification because we did not recognize your device.\n\nVerification code: 849321\n\nIf this wasn't you, secure your account immediately.",
      body_html: "beta test html ",
    },
    {
      delay: 15000,
      from_address: "security@google.com",
      subject: "Security alert: New sign-in detected",
      body_text:
        "We noticed a new sign-in to your Google Account from a new device.\n\nIf this was you, no action is needed.\nIf not, secure your account now.",
      body_html:
        "<p>We noticed a new sign-in to your Google Account from a new device.</p><p>If this was you, no action is needed.</p><p>If not, <a href='#'>secure your account now</a>.</p>",
    },
    {
      delay: 21000,
      from_address: "no-reply@figma.com",
      subject: "Confirm your email address",
      body_text:
        "Welcome to Figma!\n\nPlease confirm your email address to activate your account.\n\nConfirmation code: 572904",
      body_html:
        "<h3>Welcome to Figma!</h3><p>Please confirm your email address to activate your account.</p><p>Confirmation code: <strong>572904</strong></p>",
    },
    {
      delay: 28000,
      from_address: "billing@notion.so",
      subject: "Your Notion invoice is ready",
      body_text:
        "Hi!\n\nYour monthly invoice is now available.\nAmount: $8.00\n\nThanks for using Notion.",
      body_html:
        "<p>Hi!</p><p>Your monthly invoice is now available.</p><p><strong>Amount: $8.00</strong></p><p>Thanks for using Notion.</p>",
    },
    {
      delay: 36000,
      from_address: "team@vercel.com",
      subject: "Deploy successful ✅",
      body_text:
        "Good news! Your project has been deployed successfully.\n\nEnvironment: Production\nBuild time: 42s",
      body_html:
        "<p>Good news! Your project has been deployed successfully.</p><ul><li>Environment: <strong>Production</strong></li><li>Build time: <strong>42s</strong></li></ul>",
    },
    {
      delay: 45000,
      from_address: "alerts@bank.example",
      subject: "Код подтверждения операции",
      body_text:
        "Код подтверждения: 118233\n\nНикому не сообщайте этот код. Срок действия: 5 минут.",
      body_html:
        "<p>Код подтверждения: <strong>118233</strong></p><p>Никому не сообщайте этот код. Срок действия: 5 минут.</p>",
    },
  ];
  setTimeout(async () => {
    try {
      // БИБЛИОТЕКА ДЕЛАЕТ ВСЮ ГРЯЗНУЮ РАБОТУ:
      // Расшифровывает =D0=9D в русские буквы, убирает =3D, режет заголовки
      const parsedEmail = await simpleParser(rawMexcEmail);

      // Сохраняем в твою БД уже ИДЕАЛЬНО ЧИСТЫЕ данные
      await createEmail({
        inbox_address: inboxAddress,
        from_address:
          parsedEmail.from?.value[0]?.address || "unknown@sender.com",
        subject: parsedEmail.subject || "Без темы",
        body_text: parsedEmail.text || "", // Парсер сам достанет текст
        body_html: parsedEmail.html || "", // Парсер отдаст чистейший HTML!
      });

      console.log(
        `[СИМУЛЯЦИЯ] Распарсено и сохранено реальное письмо MEXC для ${inboxAddress}`,
      );
    } catch (error) {
      console.error("Ошибка при парсинге сырого письма:", error);
    }
  }, 10000);
  emails.forEach((email, index) => {
    setTimeout(async () => {
      try {
        await createEmail({
          inbox_address: inboxAddress,
          from_address: email.from_address,
          subject: email.subject,
          body_text: email.body_text,
          body_html: email.body_html,
        });

        console.log(
          `[СИМУЛЯЦИЯ] Письмо #${index + 1} (${email.subject}) отправлено на ${inboxAddress}`,
        );
      } catch (error) {
        console.error(
          `[СИМУЛЯЦИЯ] Ошибка при отправке письма #${index + 1}:`,
          error,
        );
      }
    }, email.delay);
  });
};
export default simulateIncomingEmails;
