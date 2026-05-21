import { emailQueue } from "../queues/emailQueue";
import { classifyEmail, getPriority } from "../utils/classifier";
// import fs from "fs";
// import path from "path";
// import { simpleParser } from "mailparser";

// Функция-генератор фейковых писем (7 штук)
export const simulateIncomingEmails = (inboxAddress: string) => {
  const emails = [
    {
      delay: 3000,
      from_address: "welcome@tempmail.dev",
      subject: "Добро пожаловать в TempMail! 🎉",
      body_text:
        "Привет!\n\nТвой временный почтовый ящик успешно создан. Он будет работать 24 часа.\n\nИспользуй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.\n\nКоманда TempMail",
      body_html:
        "<h2>Привет!</h2><p>Твой временный почтовый ящик успешно создан. Он будет работать 24 часа.</p><p>Используй этот адрес для регистраций на сомнительных сайтах, чтобы избежать спама.</p><br><p><i>Команда TempMail</i></p>",
    },
    // ... остальные письма
    {
      delay: 10000,
      from_address: "noreply@github.com",
      subject: "[GitHub] Please verify your device",
      body_text:
        "Hey Developer!\n\nA sign in attempt requires further verification because we did not recognize your device.\n\nVerification code: 849321\n\nIf this wasn't you, secure your account immediately.",
      body_html: "beta test html ",
    },
    // ... (остальные письма обрежь при желании для краткости)
  ];

  emails.forEach((email, index) => {
    setTimeout(async () => {
      try {
        // --- Теперь кладём только через BullMQ ---
        const priorityClass = classifyEmail({
          subject: email.subject,
          body_text: email.body_text,
          body_html: email.body_html,
        });

        await emailQueue.add(
          "newEmail",
          {
            inbox_address: inboxAddress,
            from_address: email.from_address,
            subject: email.subject,
            body_text: email.body_text,
            body_html: email.body_html,
          },
          {
            priority: getPriority(priorityClass),
            removeOnComplete: true,
          },
        );

        console.log(
          `[СИМУЛЯЦИЯ] Письмо #${index + 1} (${email.subject}) поставлено в очередь для ${inboxAddress} с приоритетом ${priorityClass}`,
        );
      } catch (error) {
        console.error(
          `[СИМУЛЯЦИЯ] Ошибка при постановке письма #${index + 1} в очередь:`,
          error,
        );
      }
    }, email.delay);
  });
};

export default simulateIncomingEmails;
