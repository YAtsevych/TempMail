import "./App.css";
import Header from "../src/elements/header";
import EmailSection from "../src/elements/EmailSection";
import InboxSection from "../src/elements/InboxSection";
import { useEffect, useState, useRef } from "react";

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

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const API_BASE = import.meta.env.VITE_API_URL;
  const hasFetched = useRef(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // lower-case адрес для логики
  const [emailAddress, setEmailAddress] = useState<string | null>(null);

  // отображаемый адрес (оригинал)
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);

  const [letters, setLetters] = useState<Letter[]>([]);
  const [openedLetter, setOpenedLetter] = useState<Letter | null>(null);

  // Создаем почту
  const createNewInbox = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/inbox/create`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        console.error("Create inbox failed:", data);
        return null;
      }

      const newAddress = data?.data?.address ?? null; // lower-case
      const newDisplay = data?.data?.inbox_address ?? null; // красивый

      if (!newAddress) {
        console.error("No address in response:", data);
        return null;
      }

      setEmailAddress(newAddress);
      setDisplayAddress(newDisplay);

      return newAddress;
    } catch (e) {
      console.error("createNewInbox error:", e);
      return null;
    }
  };

  // Получаем письма
  const fetchEmails = async (address: string) => {
    try {
      const response = await fetch(`${API_BASE}/emails?inbox=${address}`);
      console.log(address);
      const data = await response.json();
      console.log(data);
      setLetters(data.data ?? []);
    } catch (error) {
      console.error("Ошибка при получении писем:", error);
    }
  };

  // Удаляем и создаем новую почту
  const handleDeleteInbox = async () => {
    if (!emailAddress) return;
    try {
      const deleteResponse = await fetch(
        `${API_BASE}/inbox/${encodeURIComponent(emailAddress)}`,
        { method: "DELETE" },
      );
      const deleteResult = await deleteResponse.json();

      if (deleteResult.success) {
        setLetters([]);
        setOpenedLetter(null);
        setEmailAddress(null);
        setDisplayAddress(null);

        const createdEmail = await createNewInbox();
        if (!createdEmail) {
          console.error("Новый ящик не создался");
          return;
        }
      } else {
        console.error("Бэкенд вернул ошибку:", deleteResult.error);
      }
    } catch (error) {
      console.error("Ошибка при удалении ящика:", error);
    }
  };

  const HandlefetchEmails = async () => {
    if (!emailAddress) return;
    console.log("I have tried");
    fetchEmails(emailAddress.toLowerCase());
  };

  // связь с сервером получение почты
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    createNewInbox();
  }, []);

  // связь с сервером, получение писем, и обновление
  useEffect(() => {
    if (!emailAddress) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEmails(emailAddress);

    const intervalId = setInterval(() => {
      fetchEmails(emailAddress.toLowerCase());
    }, 5000);
    return () => clearInterval(intervalId);
  }, [emailAddress]);

  // Тема, получение от браузера
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <>
      <div
        className={`${theme === "dark" ? "dark" : "light"} flex flex-col w-full h-screen bg-[var(--color-bg)]`}
      >
        <Header
          theme={theme}
          setTheme={setTheme}
          DeleteInbox={handleDeleteInbox}
        />
        <EmailSection
          emailAddress={displayAddress ?? emailAddress} // показываем красивый
          theme={theme}
          HandlefetchEmails={HandlefetchEmails}
        />
        <InboxSection
          letters={letters}
          theme={theme}
          openedLetter={openedLetter}
          setOpenedLetter={setOpenedLetter}
        />
      </div>
    </>
  );
}

export default App;
// eslint-disable-next-line react-hooks/set-state-in-effect
