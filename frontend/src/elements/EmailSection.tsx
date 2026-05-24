import { useState } from "react";

type Theme = "dark" | "light";
type Email = string | null;
type EmailSectionProps = {
  emailAddress: Email;
  theme: Theme;
  HandlefetchEmails: () => void;
};

function EmailSection({
  emailAddress,
  theme,
  HandlefetchEmails,
}: EmailSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!emailAddress) return;
    navigator.clipboard.writeText(emailAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <section
        style={{ fontFamily: 'Geist, "Geist Fallback"' }}
        className={`${theme === "dark" ? "dark" : "light"} bg-[var(--color-bg)] shrink-0 w-full md:mb-[16px] pt-[16px] md:px-[24px] lg:px-[32px] xl:px-[152px] flex items-center justify-center`}
      >
        <div
          className={`${theme === "dark" ? "dark" : "light"} w-full max-w-7xl h-[148px] p-[16px] md:p-[24px] text-[var(--color-text)] 
          bg-[var(--color-bg-card)] card-md flex items-start justify-between flex-col sm:flex-row sm:items-center`}
        >
          <div>
            <h3 className="textGray text-[14px] text-[var(--color-text)]">
              Your temporary email address
            </h3>
            <p
              style={{ fontFamily: "Geist Mono" }}
              className={`${theme === "dark" ? "dark" : "light"} text-[var(--color-text)] text-[18px] md:text-[20px] font-[500] tracking-[-1px]`}
            >
              {emailAddress}
            </p>
          </div>

          <div className="flex flex-row w-full sm:w-auto">
            <button
              onClick={handleCopy}
              className={`${theme === "dark" ? "dark" : "light"}
                w-full inline-flex items-center justify-center gap-2
                h-9 px-[12px] mr-2
                text-sm leading-none
                rounded-xl cursor-pointer transition-all duration-200
                ${
                  copied
                    ? "bg-green-500 text-white"
                    : "text-[var(--color-bg)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
                }`}
            >
              {copied ? (
                // Галочка при копировании
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                // Иконка копирования
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-4 w-4"
                  aria-hidden="true"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              )}
              <span className="truncate">
                {copied ? "Copied!" : "Copy Address"}
              </span>
            </button>

            <button
              onClick={HandlefetchEmails}
              className={`${theme === "dark" ? "dark" : "light"} p-[10px] w-9 h-9 flex items-center justify-center text-[var(--color-text)] 
              border border-[var(--color-border)] rounded-xl
              hover:bg-[var(--color-primary)] hover:text-[var(--color-bg)]`}
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
                className="lucide lucide-refresh-cw h-4 w-4"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export default EmailSection;
