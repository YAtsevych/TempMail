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

  return (
    <>
      <div
        style={{
          fontFamily: 'Geist, "Geist Fallback"',
        }}
        className="flex w-full h-full min-h-0 pb-4  md:px-6 lg:px-8 xl:px-[152px] flex  justify-center"
      >
        <div className="flex w-full h-full min-h-0  lg:items-center lg:justify-center  max-w-7xl  ">
          {/* Правая серция писем */}
          <section
            className={`${openedLetter ? "hidden lg:flex" : "flex"} h-full min-h-0 w-full lg:mr-4  card-md md:shrink-0 lg:w-[380px]`}
          >
            <div
              className={`${theme === "dark" ? "dark" : "light"} 
                 w-full h-full  
                `}
            >
              {/* Проверка есть ли письма в ящике */}
              {letterList.length === 0 ? (
                // Если нет писем в ящике то отобразить пустышку
                <div
                  className={`${theme === "dark" ? "dark" : "light"} w-full h-full flex flex-col justify-center items-center
                `}
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
                  <p
                    className={` textGray text-[12px] text-[var(--color-text)]`}
                  >
                    Waiting for incoming messages...
                  </p>
                </div>
              ) : (
                // Если есть письма, отобразить список писем
                <div
                  className={`${theme === "dark" ? "dark" : "light"} overflow-y-auto w-full h-full min-h-0 flex flex-col items-center 
                `}
                >
                  {letterList?.map((letter) => {
                    return (
                      <>
                        <div
                          onClick={() => {
                            setOpenedLetter(letter);
                          }}
                          className={`${theme === "dark" ? "dark" : "light"} bg-[var(--color-muted)] hover:bg-[var(--color-muted-hover)] cursor-pointer
                 border-b [border-bottom-color:var(--color-border)] w-full flex flex-row p-[16px]`}
                        >
                          <div className="flex shrink-0 w-10 h-10 rounded-full items-center justify-center bg-[lab(57.0196%_18.2414_-77.6137)] ">
                            <span>E</span>
                          </div>
                          <div className="pl-4 flex-1 min-w-0">
                            {/* верхняя строка */}
                            <div className="w-full flex flex-row justify-between  items-center">
                              <h3
                                className={`${theme === "dark" ? "dark" : "light"} text-[14px] font-[600] text-[var(--color-text)]`}
                              >
                                {letter.from_address}
                              </h3>
                              <p className="textGray text-[var(--color-text)] text-[12px]">
                                {timeAgo(letter.created_at)}
                              </p>
                            </div>
                            {/* Средняястрока */}
                            <div className="textGray text-[var(--color-text)] text-[14px]">
                              <p>{letter.subject}</p>
                            </div>
                            {/* Нижняя строка */}
                            <div className="textGray text-[var(--color-text)] text-[12px] overflow-hidden">
                              <p className="h-[18px] overflow-hidden">
                                {letter.body_text}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          {/* Левая секция с открытым письмом  */}
          <section
            className={`${!openedLetter ? "hidden lg:flex" : "flex"} lg:h-full lg:w-full card-md lg:flex flex-1  lg:border-[var(--color-border)] lg:border lg:shrink-0 `}
          >
            <div
              className={`${theme === "dark" ? "dark" : "light"} 
                 w-full h-full overflow-y-auto lg:p-6
                `}
            >
              {/* Проверка открытыли письма */}
              {!openedLetter ? (
                <div
                  className={`${theme === "dark" ? "dark" : "light"} w-full h-full flex flex-col justify-center items-center
                
                `}
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
                  <p
                    className={` textGray text-[12px] text-[var(--color-text)] text-center`}
                  >
                    Select an email from the list to view its contents, <br />{" "}
                    or wait for new messages to arrive.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col h-full overflow-y-auto relative px-4">
                  <div className="flex-shrink-0 md:p-6 border-b">
                    <button
                      onClick={() => {
                        setOpenedLetter(null);
                      }}
                      className={`${theme === "dark" ? "dark" : "light"} text-[var(--color-text)] mt-4 flex flex-row justify-center items-center cursor-pointer lg:hidden`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        className="lucide lucide-arrow-left mr-2 h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="m12 19-7-7 7-7"></path>
                        <path d="M19 12H5"></path>
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
                      <div className="flex shrink-0 w-10 h-10 rounded-full items-center justify-center bg-[lab(57.0196%_18.2414_-77.6137)] ">
                        <span>E</span>
                      </div>
                      <div className="pl-4 flex-1 min-w-0">
                        {/* верхняя строка */}
                        <div className="w-full flex flex-row gap-2 items-center">
                          <h3
                            className={`${theme === "dark" ? "dark" : "light"} text-[16px] font-[600] text-[var(--color-text)]`}
                          >
                            {openedLetter.from_name ||
                              formatSenderName(openedLetter.from_address)}
                          </h3>
                          <p
                            className={`${theme === "dark" ? "dark" : "light"} text-[var(--color-text)]`}
                          >{`<${openedLetter.from_address}>`}</p>
                        </div>
                        {/* Средняястрока */}
                        <div className="textGray text-[var(--color-text)] text-[14px]">
                          <p>{formatEmailDate(openedLetter.expires_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 bg-white relative w-full">
                    {/* Создаем HTML только потому, что точно знаем: openedLetter существует! */}
                    {(() => {
                      const themedHtml = `
      <style>
        body, p, h1, h2, h3, h4, h5, h6, span, div, td, li, a {
          color: ${theme === "dark" ? "#E5E7EB" : "#111827"} !important;
        }
        body {
          background-color: transparent !important;
          margin: 0; 
          padding: 0;
        }
      </style>
      ${openedLetter.body_html}
    `;

                      return (
                        <iframe
                          srcDoc={themedHtml}
                          className="w-full border-none block"
                          title="Email content"
                          sandbox="allow-same-origin allow-popups"
                          onLoad={(e) => {
                            const iframe = e.currentTarget;
                            if (iframe.contentWindow) {
                              iframe.style.height = "0px";
                              const body = iframe.contentWindow.document.body;
                              iframe.style.height = `${body.scrollHeight + 20}px`;
                            }
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
    // sm: → ≥ 640px
    //     // md: → ≥ 768px
    //     // lg: → ≥ 1024px
    //     // xl: → ≥ 1280px
    //     // 2xl: → ≥ 1536px
  );
}
export default InboxSection;
const timeAgo = (dateString: string): string => {
  const nowMs = Date.now();
  const dateMs = new Date(dateString).getTime();

  // защита от невалидной даты
  if (Number.isNaN(dateMs)) return "";

  const diffSec = Math.floor((nowMs - dateMs) / 1000);

  if (diffSec < 60) return "только что";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} дн назад`;

  return new Date(dateMs).toLocaleDateString("ru-RU");
};
// Функция для красивого имени отправителя
const formatSenderName = (fromAddress: string) => {
  if (!fromAddress || !fromAddress.includes("@")) return "Unknown";

  // 1. Берем часть после @ (github.com)
  const domainPart = fromAddress.split("@")[1];

  // 2. Берем часть до точки (github)
  const namePart = domainPart.split(".")[0];

  // 3. Делаем первую букву заглавной (Github)
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
};
const formatEmailDate = (dateString: string, locale: string = "en-US") => {
  const date = new Date(dateString);

  // Используем Intl.DateTimeFormat под капотом (через toLocaleString)
  return date.toLocaleString(locale, {
    year: "numeric", // '2026'
    month: "short", // 'Apr' или 'мар.'
    day: "numeric", // '19' или '4'
    hour: "numeric", // '4 AM' или '15'
    minute: "2-digit", // '41' или '29'
    // second: '2-digit' // Раскомментируй, если прям нужны секунды (обычно в почте их прячут)
  });
};
// {
//     "id": "197d114e-d660-4799-8d83-80fb9151d707",
//     "inbox_address": "RichardAllen7536@tempmail.dev",
//     "from_address": "noreply@github.com",
//     "subject": "[GitHub] Please verify your device",
//     "body_html": "<p>Hey Developer!</p><p>A sign in attempt requires further verification because we did not recognize your device.</p><p>Verification code: <strong>849321</strong></p><p>If you did not attempt to sign in to your account, your password may be compromised.</p>",
//     "body_text": "Hey Developer!\n\nA sign in attempt requires further verification because we did not recognize your device. To complete the sign in, enter the verification code on the unrecognized device.\n\nVerification code: 849321\n\nIf you did not attempt to sign in to your account, your password may be compromised.",
//     "confirmation_code": "849321",
//     "is_read": false,
//     "created_at": "2026-04-17T21:51:15.265Z",
//     "expires_at": "2026-04-18T01:51:15.263Z"
// }
