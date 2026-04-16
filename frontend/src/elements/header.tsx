import { useEffect, useState } from "react";
type Theme = "dark" | "light";
type HeaderProps = {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
};
function Header({ theme, setTheme }: HeaderProps) {
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
        className={`${theme === "dark" ? "bg-[lab(1.5459_-0.0968501_-1.40916)]" : "bg-white"} w-full h-16 p-[14px] md:p-[24px] lg:p-[0_152px]  text-[lab(94.1962_-0.55328_-1.78922)] flex items-center justify-between`}
      >
        <div className="flex row items-center ">
          <div className="w-9 h-9 mr-2 rounded-full bg-[lab(57.0196_18.2414_-77.6137)] flex justify-center items-center text-[#1f2937]">
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
            className={`${theme === "light" ? "text-black font-[700] " : "text-[lab(94.1962_-0.55328_-1.78922)]"}  text-xl font-[700] tracking-[-1px]`}
          >
            TempMail
            <span className="text-[lab(57.0196_18.2414_-77.6137)]">.dev</span>
          </div>{" "}
        </div>

        <div className="  flex row items-center justify-center">
          {screenWidth > 640 ? (
            <button className="hover:bg-[#1f5cff]/50 p-[10px] hover:rounded-[10px] hover:text-[#d40924] text-[14px] h-[32px] mr-4 flex items-center justify-center text-[lab(59.3909_-1.07732_-3.56233)]">
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
              Delete Inbox
            </button>
          ) : (
            <button className="w-9 h-9 mr-4 flex items-center justify-center text-[lab(59.3909_-1.07732_-3.56233)]">
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
      </header>
    </>
  );
}
export default Header;
