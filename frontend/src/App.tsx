import "./App.css";
import Header from "../src/elements/header";
import EmailSection from "../src/elements/EmailSection";
import InboxSection from "../src/elements/InboxSection";
import { useEffect, useState, useRef, useCallback } from "react";
import { io as socketIO, Socket } from "socket.io-client";

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

// Підключається до WebSocket і підписується на інбокс
// При отриманні нового листа викликає onNewEmail
function useWebSocket(
  emailAddress: string | null,
  onNewEmail: (letter: Letter) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (!emailAddress) return;

    const WS_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = socketIO(WS_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setWsConnected(true);
      socket.emit("SUBSCRIBE_MAILBOX", emailAddress);
    });

    socket.on("disconnect", () => setWsConnected(false));

    // Новий лист від сервера — вставляємо на початок списку
    socket.on("NEW_EMAIL", (letter: Letter) => onNewEmail(letter));

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

  // useCallback щоб не пересоздавати сокет при кожному рендері
  const handleNewEmail = useCallback((letter: Letter) => {
    setLetters((prev) => {
      // Захист від дублів якщо polling і WS прийшли одночасно
      if (prev.find((l) => l.id === letter.id)) return prev;
      return [letter, ...prev];
    });
  }, []);

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
    } catch {
      return null;
    }
  };

  const fetchEmails = async (address: string) => {
    try {
      const response = await fetch(`${API_BASE}/emails?inbox=${address}`);
      const data = await response.json();
      setLetters(data.data ?? []);
    } catch {
      // ігноруємо — наступний polling спробує знову
    }
  };

  const handleDeleteInbox = async () => {
    if (!emailAddress) return;
    try {
      const res = await fetch(
        `${API_BASE}/inbox/${encodeURIComponent(emailAddress)}`,
        { method: "DELETE" },
      );
      const result = await res.json();
      if (result.success) {
        setLetters([]);
        setOpenedLetter(null);
        setEmailAddress(null);
        setDisplayAddress(null);
        await createNewInbox();
      }
    } catch {
      // тихо
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

    // Polling як fallback якщо WS відвалився
    const intervalId = setInterval(() => {
      fetchEmails(emailAddress.toLowerCase());
    }, 30000);
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
        wsConnected={wsConnected}
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
