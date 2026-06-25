import React, { useState } from "react";
type Theme = "dark" | "light";

export type Letter = {
  id: string;
  from_address: string;
  subject: string;
  body_text: string;
  created_at: string;
  is_read: boolean;
  from_name?: string;
  expires_at: string;
  body_html: string;
};

type InboxProps = {
  theme: Theme;
  letters: Letter[];
  openedLetter: Letter | null;
  setOpenedLetter: (letter: Letter | null) => void;
};

function InboxSection({
  theme,
  letters = [],
  openedLetter,
  setOpenedLetter,
}: InboxProps) {
  const letterList = Array.isArray(letters) ? letters : [];
  console.log(letters);
  // Добавь эти переменные перед return твоего компонента:
  const isDark = theme === "dark";
  // Инвертируем весь iframe (белый станет черным)
  const iframeFilterStyle = isDark
    ? { filter: "invert(1) hue-rotate(180deg)" }
    : {};
  // Возвращаем картинки в нормальное состояние внутри письма
  const imageInvertFix = isDark
    ? `<style>img, picture, video, .image { filter: invert(1) hue-rotate(180deg) !important; }</style>`
    : "";

  return (
    <div
      style={{ fontFamily: 'Geist, "Geist Fallback"' }}
      className="flex w-full h-full min-h-0 pb-4 md:px-6 lg:px-8 xl:px-[152px] flex justify-center"
    >
      <div className="flex w-full h-full min-h-0 lg:items-center lg:justify-center max-w-7xl ">
        {/* Список листів */}
        <section
          className={`${openedLetter ? "hidden lg:flex" : "flex"} h-full min-h-0 w-full lg:mr-4 card-md md:shrink-0 lg:w-[380px]`}
        >
          <div
            className={`${theme === "dark" ? "dark" : "light"} w-full h-full`}
          >
            {letterList.length === 0 ? (
              <div
                className={`${theme === "dark" ? "dark" : "light"} w-full h-full flex flex-col justify-center items-center`}
              >
                <div className="empty-mail-wave">
                  <div className="empty-mail-core">
                    <div className="empty-mail-core-inner" />
                  </div>
                </div>
                <h4
                  className={`${theme === "dark" ? "dark" : "light"} text-[14px] text-[var(--color-text)]`}
                >
                  No emails yet
                </h4>
                <p className="textGray text-[12px] text-[var(--color-text)]">
                  Waiting for incoming messages...
                </p>
              </div>
            ) : (
              <div
                className={`${theme === "dark" ? "dark" : "light"} overflow-y-auto w-full h-full min-h-0 flex flex-col items-center`}
              >
                {letterList.map((letter) => (
                  <div
                    key={letter.id}
                    onClick={() => setOpenedLetter(letter)}
                    className={`${theme === "dark" ? "dark" : "light"} bg-[var(--color-muted)] hover:bg-[var(--color-muted-hover)] cursor-pointer border-b [border-bottom-color:var(--color-border)] w-full flex flex-row p-[16px]`}
                  >
                    <Avatar fromAddress={letter.from_address} />
                    <div className="pl-4 flex-1 min-w-0">
                      <div className="w-full flex flex-row justify-between items-center">
                        {/* Добавлен truncate. Важно: для соседа (timeAgo) добавлен whitespace-nowrap и shrink-0, чтобы дата не сжималась */}
                        <h3
                          className={`${theme === "dark" ? "dark" : "light"} text-[14px] font-[600] text-[var(--color-text)] truncate mr-2`}
                        >
                          {letter.from_address}
                        </h3>
                        <p className="textGray text-[var(--color-text)] text-[12px] whitespace-nowrap shrink-0">
                          {timeAgo(letter.created_at)}
                        </p>
                      </div>

                      {/* Добавлен truncate, убран лишний тег <p> */}
                      <div className="textGray text-[var(--color-text)] text-[14px] truncate">
                        {letter.subject || "(Без темы)"}
                      </div>

                      {/* Добавлен truncate, убран костыль с фиксированной высотой */}
                      <div className="textGray text-[var(--color-text)] text-[12px] truncate">
                        {letter.body_text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Відкритий лист */}
        <section
          className={`${!openedLetter ? "hidden lg:flex" : "flex"} lg:h-full lg:w-full card-md lg:flex flex-1 lg:border-[var(--color-border)] lg:border lg:shrink-0`}
        >
          <div
            className={`${theme === "dark" ? "dark" : "light"} w-full h-full overflow-y-auto lg:p-6`}
          >
            {!openedLetter ? (
              <div
                className={`${theme === "dark" ? "dark" : "light"} w-full h-full flex flex-col justify-center items-center`}
              >
                <div className="empty-mail-wave">
                  <div className="empty-mail-core">
                    <div className="empty-mail-core-inner" />
                  </div>
                </div>
                <h4
                  className={`${theme === "dark" ? "dark" : "light"} text-[14px] text-[var(--color-text)]`}
                >
                  Waiting for incoming emails...
                </h4>
                <p className="textGray text-[12px] text-[var(--color-text)] text-center">
                  Select an email from the list to view its contents, <br />
                  or wait for new messages to arrive.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-y-auto relative px-4">
                <div
                  className={`${theme === "dark" ? "dark" : "light border-b"} flex-shrink-0 md:p-6 `}
                >
                  <button
                    onClick={() => setOpenedLetter(null)}
                    className={`${theme === "dark" ? "dark" : "light"} text-[var(--color-text)] mt-4 flex flex-row justify-center items-center cursor-pointer lg:hidden`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-arrow-left mr-2 h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="m12 19-7-7 7-7" />
                      <path d="M19 12H5" />
                    </svg>
                    <p
                      className={`${theme === "dark" ? "dark" : "light"} text-[var(--color-text)]`}
                    >
                      Back to inbox
                    </p>
                  </button>

                  <h2
                    className={`${theme === "dark" ? "dark" : "light"} text-[24px] font-[600] text-[var(--color-text)] mb-4`}
                  >
                    {openedLetter.subject}
                  </h2>

                  <div className="flex flex-row min-h-0 flex-shrink-0">
                    <Avatar fromAddress={openedLetter.from_address} />
                    <div className="pl-4 flex-1 min-w-0">
                      <div className="w-full flex flex-row gap-2 items-center">
                        <h3
                          className={`${theme === "dark" ? "dark" : "light"} text-[16px] font-[600] text-[var(--color-text)]`}
                        >
                          {openedLetter.from_name ||
                            formatSenderName(openedLetter.from_address)}
                        </h3>
                        <p
                          className={`${theme === "dark" ? "dark" : "light"} text-[var(--color-text)]`}
                        >
                          {`<${openedLetter.from_address}>`}
                        </p>
                      </div>
                      <div className="textGray text-[var(--color-text)] text-[14px]">
                        <p>{formatEmailDate(openedLetter.expires_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`${isDark ? "dark" : "light"} flex-1 relative w-full min-w-0 overflow-hidden`}
                >
                  <iframe
                    style={iframeFilterStyle}
                    srcDoc={`
      ${imageInvertFix}
      
      ${openedLetter.body_html || openedLetter.body_text || "Пустое письмо"}
    `}
                    className="w-full border-none block"
                    title="Email content"
                    sandbox="allow-same-origin allow-popups"
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      if (iframe.contentWindow) {
                        iframe.style.height = "0px";
                        const body = iframe.contentWindow.document.body;

                        // Используем scrollHeight, но добавляем запас для возможных подгрузок
                        const newHeight = body.scrollHeight + 30;
                        iframe.style.height = `${newHeight}px`;

                        // Опционально: настраиваем MutationObserver, чтобы пересчитывать высоту,
                        // если письмо динамически меняет размер (например, при загрузке картинок)
                        const observer = new MutationObserver(() => {
                          iframe.style.height = "0px";
                          iframe.style.height = `${body.scrollHeight + 30}px`;
                        });
                        observer.observe(body, {
                          childList: true,
                          subtree: true,
                          attributes: true,
                        });
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default InboxSection;

// Показує скільки часу минуло з моменту отримання листа
const timeAgo = (dateString: string): string => {
  const nowMs = Date.now();
  const dateMs = new Date(dateString).getTime();
  if (Number.isNaN(dateMs)) return "";

  const diffSec = Math.floor((nowMs - dateMs) / 1000);
  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateMs).toLocaleDateString("en-US");
};

// Витягує назву сервісу з email адреси відправника
const formatSenderName = (fromAddress: string) => {
  if (!fromAddress || !fromAddress.includes("@")) return "Unknown";
  const domain = fromAddress.split("@")[1];
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// Форматує дату листа для відображення
const formatEmailDate = (dateString: string, locale = "en-US") => {
  return new Date(dateString).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

interface AvatarProps {
  fromAddress?: string;
}

// Палитра мягких, но контрастных цветов (как в Gmail)
const GMAIL_COLORS = [
  "#e57373",
  "#f06292",
  "#ba68c8",
  "#9575cd",
  "#7986cb",
  "#64b5f6",
  "#4fc3f7",
  "#4dd0e1",
  "#4db6ac",
  "#81c784",
  "#aed581",
  "#ff8a65",
  "#d4e157",
  "#ffd54f",
  "#ffb74d",
];

// Функция генерации стабильного цвета на основе строки
const getAvatarColor = (email: string): string => {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    // Побитовый сдвиг для создания уникального числа из строки
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Берем остаток от деления, чтобы индекс не вышел за пределы массива
  const index = Math.abs(hash) % GMAIL_COLORS.length;
  return GMAIL_COLORS[index];
};

export const Avatar: React.FC<AvatarProps> = ({ fromAddress }) => {
  const [imgError, setImgError] = useState(false);

  if (!fromAddress) {
    return <div className="flex shrink-0 w-10 h-10 rounded-full bg-gray-300" />;
  }

  const cleanEmail = fromAddress.toLowerCase().trim();
  const domain = cleanEmail.includes("@") ? cleanEmail.split("@")[1] : null;
  const letter = cleanEmail.charAt(0).toUpperCase();

  if (!imgError && domain) {
    const logoUrl = `https://logo.clearbit.com/${domain}`;
    return (
      <img
        src={logoUrl}
        alt={letter}
        onError={() => setImgError(true)}
        className="flex shrink-0 w-10 h-10 rounded-full object-cover bg-white"
      />
    );
  }

  // Вычисляем стабильный цвет для конкретного email
  const backgroundColor = getAvatarColor(cleanEmail);

  return (
    <div
      className="flex shrink-0 w-10 h-10 rounded-full items-center justify-center text-white font-[600] text-[16px]"
      style={{ backgroundColor }} // Применяем вычисленный цвет через style
    >
      <span>{letter}</span>
    </div>
  );
};
