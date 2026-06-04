import { FormEvent, useEffect, useRef, useState } from "react";
import { MessageCircle, X, LoaderCircle, RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import "./App.css";
import { ChatApiError, sendChatMessage } from "./services/chatApi";
import { ChatMessage } from "./types";

const QUICK_QUESTIONS = [
  "Mi moto no enciende",
  "Para que sirve una bujia?",
  "Cuando cambio el aceite?",
  "Como se si las balatas estan gastadas?",
  "Que debo revisar antes de comprar una bateria?",
];

const initialHistory = (): ChatMessage[] => [
  {
    role: "assistant",
    content: "Soy MecaBot. Te ayudo con dudas sobre repuestos y piezas de moto.",
  },
];

const STORAGE_KEY = "mecabot.chat.history.v1";

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as ChatMessage;
  return (
    (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string" &&
    item.content.trim().length > 0
  );
};

const loadHistory = (): ChatMessage[] => {
  if (typeof window === "undefined") {
    return initialHistory();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return initialHistory();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return initialHistory();
    }

    const cleaned = parsed.filter(isChatMessage).slice(-20);
    return cleaned.length > 0 ? cleaned : initialHistory();
  } catch {
    return initialHistory();
  }
};

function App() {
  const [history, setHistory] = useState<ChatMessage[]>(() => loadHistory());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = message.trim().length > 0 && !loading;

  const persistHistory = (nextHistory: ChatMessage[]) => setHistory(nextHistory);

  const resetChat = () => {
    persistHistory(initialHistory());
    setError("");
    setMessage("");
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // el chat sigue funcionando aunque el almacenamiento local falle
    }
  }, [history]);

  useEffect(() => {
    if (!open) {
      return;
    }
    requestAnimationFrame(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
      endRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
      setTimeout(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
      }, 10);
    });
  }, [history, loading, open]);

  const handleSend = async (content: string) => {
    const userMessage = content.trim();
    if (!userMessage || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const userEntry: ChatMessage = { role: "user", content: userMessage };
    const optimisticHistory = [...history, userEntry];
    persistHistory(optimisticHistory);

    try {
      const result = await sendChatMessage(userMessage, history.slice(-10));
      const assistantEntry: ChatMessage = {
        role: "assistant",
        content: result.reply,
        source: result.source,
      };
      persistHistory([...optimisticHistory, assistantEntry]);
    } catch (error) {
      if (error instanceof ChatApiError && error.status === 400) {
        const compactHistory = optimisticHistory
          .slice(0, -1)
          .filter((item) => item.content.trim().length > 0)
          .slice(-6)
          .map((item) => ({
            role: item.role,
            content: item.content.slice(0, 400),
          }));

        try {
          const retried = await sendChatMessage(userMessage, compactHistory);
          persistHistory([
            ...optimisticHistory,
            { role: "assistant", content: retried.reply, source: retried.source },
          ]);
          return;
        } catch {
          // sigue al fallback visual
        }
      }

      setError("No fue posible responder ahora. Intenta de nuevo.");
      persistHistory([
        ...optimisticHistory,
        {
          role: "assistant",
          content:
            "No tengo conexion con IA en este momento. Puedes preguntarme por bujia, bateria, frenos, aceite o sintomas de falla.",
          source: "local",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSend(message);
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, lineIndex) => {
      const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
      return (
        <span key={`line-${lineIndex}`}>
          {parts.map((part, partIndex) => {
            const isBold = part.startsWith("**") && part.endsWith("**") && part.length > 4;
            if (isBold) {
              return <strong key={`part-${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>;
            }
            return <span key={`part-${lineIndex}-${partIndex}`}>{part}</span>;
          })}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      );
    });
  };

  const widget = (
    <main className="widget-root">
      {open ? <button type="button" className="chat-backdrop" onMouseDown={() => setOpen(false)} aria-label="Cerrar por fuera" /> : null}
      {open ? (
        <section className="chat-shell">
          <header className="chat-header">
            <div>
              <h1>MecaBot</h1>
              <p>Asesor de piezas automotoras</p>
            </div>
            <div className="header-actions">
              <button type="button" className="icon-button" onClick={resetChat} aria-label="Nuevo chat">
                <RotateCcw size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar chat"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="quick-actions">
            {QUICK_QUESTIONS.map((item) => (
              <button key={item} type="button" onClick={() => void handleSend(item)} disabled={loading}>
                {item}
              </button>
            ))}
          </div>

          <div className="messages" ref={messagesRef}>
            {history.map((entry, index) => (
              <article key={`${entry.role}-${index}`} className={`bubble ${entry.role}`}>
                <span>{renderFormattedText(entry.content)}</span>
                {entry.role === "assistant" && entry.source ? (
                  <span className={`source-pill source-${entry.source}`}>fuente: {entry.source}</span>
                ) : null}
              </article>
            ))}
            {loading && (
              <article className="bubble assistant loading-bubble">
                <LoaderCircle size={18} className="spinner" />
                <span>Pensando...</span>
              </article>
            )}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={onSubmit}>
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribe tu pregunta..."
              maxLength={600}
            />
            <button type="submit" disabled={!canSend}>
              Enviar
            </button>
          </form>

          {error && <p className="error">{error}</p>}
          <p className="note">
            Respuestas orientativas. No reemplazan la revision de un mecanico calificado.
          </p>
        </section>
      ) : null}

      <button
        type="button"
        className="fab"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Cerrar asesor" : "Abrir asesor"}
      >
        <MessageCircle size={24} />
      </button>
    </main>
  );

  return createPortal(widget, document.body);
}

export default App;
