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
  const hasFetched = useRef(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  // 1. Храним текущий email-адрес ящика
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  // 2. Храним список писем (по умолчанию пустой массив)
  const [letters, setLetters] = useState<Letter[]>([]);
  const [openedLetter, setOpenedLetter] = useState<Letter | null>(null);

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //3. Создаем почту
  const createNewInbox = async (): Promise<string | null> => {
    try {
      const res = await fetch("http://localhost:4000/inbox/create", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        console.error("Create inbox failed:", data);
        return null;
      }

      const newEmail = data?.data?.address ?? null;
      if (!newEmail) {
        console.error("No address in response:", data);
        return null;
      }

      setEmailAddress(newEmail);
      return newEmail;
    } catch (e) {
      console.error("createNewInbox error:", e);
      return null;
    }
  };
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //4. Получаем письма
  const fetchEmails = async (address: string) => {
    try {
      const response = await fetch(
        `http://localhost:4000/emails?inbox=${address}`,
      );
      const data = await response.json();

      setLetters(data.data ?? []);
    } catch (error) {
      console.error("Ошибка при получении писем:", error);
    }
  };
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //5. УДаляем и создаем новую почту
  const handleDeleteInbox = async () => {
    if (!emailAddress) return;
    try {
      const deleteResponse = await fetch(
        `http://localhost:4000/inbox/${encodeURIComponent(emailAddress)}`,
        { method: "DELETE" },
      );
      const deleteResult = await deleteResponse.json();

      if (deleteResult.success) {
        console.log("delete success");
        // 2. Очищаем интерфейс (чтобы старые письма не висели на экране)
        setLetters([]);
        setOpenedLetter(null);
        setEmailAddress(null);
        // 3. Создаем новый ящик (вызываем твою уже готовую функцию)
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
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  const HandlefetchEmails = async () => {
    if (!emailAddress) return;
    fetchEmails(emailAddress);
  };
  //связь с сервером получение почты
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    createNewInbox();
  }, []);
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //связь с сервером, получение писем, и обновление
  useEffect(() => {
    if (!emailAddress) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEmails(emailAddress);

    const intervalId = setInterval(() => {
      fetchEmails(emailAddress);
    }, 500000);
    return () => clearInterval(intervalId);
  }, [emailAddress]);
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //Тема, получение от браузера
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
  ////////////////////////////////////////////////////////////////////////////////////////////////////
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
          emailAddress={emailAddress}
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
