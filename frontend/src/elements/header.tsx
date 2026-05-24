import { useEffect, useState } from "react";
type Theme = "dark" | "light";
type HeaderProps = {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  DeleteInbox: () => void;
  wsConnected: boolean;
};
function Header({ theme, setTheme, DeleteInbox, wsConnected }: HeaderProps) {
  const [screenWidth, setScreenWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <header
        style={{
          fontFamily: 'Geist, "Geist Fallback"',
        }}
        className={`${theme === "dark" ? "dark" : "light"} bg-[var(--color-bg)] border-0 border-b shadow-[0_1px_3px_0_#0000001a,0_1px_2px_-1px_#0000001a] [border-bottom-color:var(--color-border)] w-full h-16 p-[14px] md:p-[24px] lg:px-[32px] xl:px-[152px]  text-[lab(94.1962_-0.55328_-1.78922)] flex items-center justify-center`}
      >
        <div className="w-full max-w-7xl flex items-center justify-between">
          <div className="flex row items-center ">
            <div
              className={`${theme === "dark" ? "dark" : "light"} w-9 h-9 mr-2 rounded-full bg-[var(--color-primary)] flex justify-center items-center text-[var(--color-bg)]`}
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
                className="lucide lucide-mail h-5 w-5 text-primary-foreground"
                aria-hidden="true"
              >
                <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path>
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              </svg>
            </div>
            <div
              className={`${theme === "dark" ? "dark" : "light"} text-[var(--color-text)] text-xl font-[700] tracking-[-1px]`}
            >
              TempMail
              <span className="text-[lab(57.0196_18.2414_-77.6137)]">.dev</span>
            </div>{" "}
          </div>

          <div className="  flex row items-center justify-center">
            {screenWidth > 640 ? (
              <button
                onClick={DeleteInbox}
                className="
                   inline-flex items-center gap-2
                   h-8 px-2.5 mr-4
                   text-sm leading-none textGray text-[var(--color-text)]
                   rounded-md
                   hover:bg-[#1f5cff]/50 hover:text-[#d40924]
                   transition-colors
                 "
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span className="truncate">Delete Inbox</span>
              </button>
            ) : (
              <button
                onClick={DeleteInbox}
                className="w-9 h-9 mr-4 flex items-center justify-center text-[lab(59.3909_-1.07732_-3.56233)]"
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
                  className="lucide lucide-trash2 lucide-trash-2 mr-2 h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            )}
            <div className="flex items-center gap-1 mr-2">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  wsConnected ? "bg-green-500" : "bg-gray-400"
                }`}
                title={
                  wsConnected ? "WebSocket: live" : "WebSocket: reconnecting"
                }
              />
              <span className="text-xs textGray text-[var(--color-text)] hidden sm:block">
                {wsConnected ? "live" : "polling"}
              </span>
            </div>
            {theme === "dark" ? (
              <button
                onClick={() => {
                  setTheme("light");
                }}
                className="p-[10px] w-9 h-9 flex items-center justify-center text-white hover:bg-[#1f5cff]/50 hover:rounded-[10px]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => {
                  setTheme("dark");
                }}
                className="p-[10px] w-9 h-9 flex items-center justify-center text-black hover:bg-[#1f5cff]/50 hover:rounded-[10px] hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
export default Header;
