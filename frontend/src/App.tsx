// frontend/src/App.tsx
// Изменения относительно оригинала:
//   1. Добавлен хук useWebSocket — подписка через Socket.io
//   2. При получении NEW_EMAIL — письмо вставляется в начало списка (без запроса к серверу)
//   3. setInterval снижен с 5с до 30с — работает только как fallback
//   4. WebSocket индикатор в header через проп wsConnected

import "./App.css";
import Header from "../src/elements/header";
import EmailSection from "../src/elements/EmailSection";
import InboxSection from "../src/elements/InboxSection";
import { useEffect, useState, useRef, useCallback } from "react";
import { io as socketIO, Socket } from "socket.io-client"; // <-- НОВОЕ

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

// ── WebSocket хук ──────────────────────────────────────────
// Подключается к серверу, подписывается на комнату mailbox:<address>,
// при получении NEW_EMAIL вызывает onNewEmail(letter).
//
// Возвращает wsConnected для UI-индикатора (можно показать в header).
function useWebSocket(
  emailAddress: string | null,
  onNewEmail: (letter: Letter) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (!emailAddress) return;

    const WS_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

    // Создаём соединение
    const socket = socketIO(WS_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setWsConnected(true);
      console.log("[WS] Connected, subscribing to:", emailAddress);
      // Подписываемся на комнату нашего mailbox
      socket.emit("SUBSCRIBE_MAILBOX", emailAddress);
    });

    socket.on("disconnect", () => {
      setWsConnected(false);
      console.log("[WS] Disconnected");
    });

    // Сервер прислал новое письмо → добавляем в начало списка
    // Это срабатывает мгновенно после обработки воркером (< 100ms)
    socket.on("NEW_EMAIL", (letter: Letter) => {
      console.log("[WS] NEW_EMAIL received:", letter.subject);
      onNewEmail(letter);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [emailAddress, onNewEmail]);

  return { wsConnected };
}

function App() {
  const API_BASE = import.meta.env.VITE_API_URL;
  const hasFetched = useRef(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [openedLetter, setOpenedLetter] = useState<Letter | null>(null);

  // Колбэк для WebSocket хука — вставляем новое письмо в начало списка.
  // useCallback нужен чтобы не пересоздавать socket при каждом рендере.
  const handleNewEmail = useCallback((letter: Letter) => {
    setLetters((prev) => {
      // Защита от дублей (если вдруг polling и WS пришли одновременно)
      if (prev.find((l) => l.id === letter.id)) return prev;
      return [letter, ...prev];
    });
  }, []);

  // ── WebSocket подписка ────────────────────────────────────
  const { wsConnected } = useWebSocket(emailAddress, handleNewEmail);

  const createNewInbox = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/inbox/create`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.success) return null;

      const newAddress = data?.data?.address ?? null;
      const newDisplay = data?.data?.inbox_address ?? null;
      if (!newAddress) return null;

      setEmailAddress(newAddress);
      setDisplayAddress(newDisplay);
      return newAddress;
    } catch (e) {
      console.error("createNewInbox error:", e);
      return null;
    }
  };

  const fetchEmails = async (address: string) => {
    try {
      const response = await fetch(`${API_BASE}/emails?inbox=${address}`);
      const data = await response.json();
      setLetters(data.data ?? []);
    } catch (error) {
      console.error("Ошибка при получении писем:", error);
    }
  };

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
        await createNewInbox();
      }
    } catch (error) {
      console.error("Ошибка при удалении ящика:", error);
    }
  };

  const HandlefetchEmails = async () => {
    if (!emailAddress) return;
    fetchEmails(emailAddress.toLowerCase());
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    createNewInbox();
  }, []);

  useEffect(() => {
    if (!emailAddress) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEmails(emailAddress);

    // Polling снижен с 5с → 30с.
    // Теперь это только fallback на случай потери WS-соединения.
    // Основная доставка — через WebSocket (мгновенно).
    const intervalId = setInterval(() => {
      fetchEmails(emailAddress.toLowerCase());
    }, 30000); // <-- было 5000, стало 30000
    return () => clearInterval(intervalId);
  }, [emailAddress]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? "dark" : "light");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div
      className={`${theme === "dark" ? "dark" : "light"} flex flex-col w-full h-screen bg-[var(--color-bg)]`}
    >
      <Header
        theme={theme}
        setTheme={setTheme}
        DeleteInbox={handleDeleteInbox}
        wsConnected={wsConnected} // <-- передаём статус WS в header
      />
      <EmailSection
        emailAddress={displayAddress ?? emailAddress}
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
  );
}

export default App;
