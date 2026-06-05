import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { MessageCircle, Mic, MicOff, Paperclip, SendHorizontal, X, RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import "./App.css";
import { ChatApiError, sendChatMessage, transcribeAudio } from "./services/chatApi";
import { AudioInput, ChatImageInput, ChatMessage } from "./types";

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
    content: "Soy Juan Mecánico AI. Te ayudo con dudas sobre repuestos y piezas de moto.",
  },
];

const STORAGE_KEY = "mecabot.chat.history.v1";
const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES: Array<ChatImageInput["mimeType"]> = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

type SelectedImage = {
  name: string;
  mimeType: ChatImageInput["mimeType"];
  dataUrl: string;
};

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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No se pudo leer la imagen"));
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });

const toChatImageInput = (image: SelectedImage): ChatImageInput => ({
  mimeType: image.mimeType,
  data: image.dataUrl.split(",")[1] ?? image.dataUrl,
});

const toAudioInput = (dataUrl: string, mimeType: string): AudioInput => ({
  mimeType,
  data: dataUrl.split(",")[1] ?? dataUrl,
});

const shrinkImage = async (dataUrl: string): Promise<string> => {
  const bitmap = await createImageBitmap(await fetch(dataUrl).then((response) => response.blob()));
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};

function App() {
  const [history, setHistory] = useState<ChatMessage[]>(() => loadHistory());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [typingState, setTypingState] = useState<{ index: number; text: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const closeTimerRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const canSend = (message.trim().length > 0 || Boolean(selectedImage)) && !loading;
  const isChatVisible = open || closing;

  const persistHistory = (nextHistory: ChatMessage[]) => setHistory(nextHistory);

  const resetChat = () => {
    persistHistory(initialHistory());
    setError("");
    setMessage("");
    setSelectedImage(null);
    setImageError("");
    setVoiceError("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // el chat sigue funcionando aunque el almacenamiento local falle
    }
  }, [history]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

  const closeChat = () => {
    if (closing) {
      return;
    }

    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimerRef.current = null;
    }, 220);
  };

  const openChat = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setClosing(false);
    setOpen(true);
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const clearVoiceRecordingState = () => {
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
  };

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("No se pudo procesar el audio"));
      };
      reader.onerror = () => reject(new Error("No se pudo procesar el audio"));
      reader.readAsDataURL(blob);
    });

  const pickRecorderMimeType = (): string | undefined =>
    AUDIO_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

  const startVoiceCapture = async () => {
    if (isTranscribing || loading) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Tu navegador no soporta grabación de voz.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const selectedMimeType = pickRecorderMimeType();
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      setVoiceError("");
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setVoiceError("No fue posible grabar el audio.");
        clearVoiceRecordingState();
      };

      recorder.onstop = async () => {
        try {
          setIsTranscribing(true);
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || selectedMimeType || "audio/webm",
          });
          const dataUrl = await blobToDataUrl(blob);
          const payload = toAudioInput(dataUrl, (blob.type || selectedMimeType || "audio/webm").split(";")[0]);
          const result = await transcribeAudio(payload);
          setMessage(result.transcript.trim());
          setVoiceError("");
        } catch {
          setVoiceError("No pudimos transcribir la voz. Intenta de nuevo.");
        } finally {
          setIsTranscribing(false);
          clearVoiceRecordingState();
        }
      };

      recorder.start();
    } catch {
      setVoiceError("Necesito permiso para usar el micrófono.");
      clearVoiceRecordingState();
    }
  };

  const stopVoiceCapture = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleVoiceCapture = () => {
    if (isRecording) {
      stopVoiceCapture();
      return;
    }

    void startVoiceCapture();
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as ChatImageInput["mimeType"])) {
      setImageError("Solo se permiten imágenes JPG, PNG o WEBP.");
      clearSelectedImage();
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError("La imagen supera el tamaño máximo permitido.");
      clearSelectedImage();
      return;
    }

    try {
      const rawDataUrl = await readFileAsDataUrl(file);
      const previewDataUrl = rawDataUrl.startsWith("data:image/")
        ? await shrinkImage(rawDataUrl)
        : rawDataUrl;
      setSelectedImage({
        name: file.name,
        mimeType: "image/jpeg",
        dataUrl: previewDataUrl,
      });
      setImageError("");
    } catch {
      setImageError("No fue posible cargar la imagen.");
      clearSelectedImage();
    }
  };

  const startTypingEffect = (index: number, fullText: string) => {
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    setTypingState({ index, text: "" });

    const chars = Array.from(fullText);
    let current = 0;
    const stepSize = Math.max(1, Math.ceil(chars.length / 80));

    typingTimerRef.current = window.setInterval(() => {
      current += stepSize;
      const nextText = chars.slice(0, current).join("");
      setTypingState({ index, text: nextText });

      if (current >= chars.length) {
        if (typingTimerRef.current) {
          window.clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }

        setTypingState(null);
      }
    }, 30);
  };

  const handleSend = async (content: string) => {
    const userMessage = content.trim();
    if ((!userMessage && !selectedImage) || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setImageError("");

    const pendingImage = selectedImage;
    if (pendingImage) {
      clearSelectedImage();
    }

    const userEntry: ChatMessage = {
      role: "user",
      content: userMessage || "Imagen adjunta",
    };
    const optimisticHistory = [...history, userEntry];
    persistHistory(optimisticHistory);

    try {
      const result = await sendChatMessage(
        userMessage,
        history.slice(-10),
        pendingImage ? toChatImageInput(pendingImage) : undefined,
      );
      const assistantEntry: ChatMessage = {
        role: "assistant",
        content: result.reply,
        source: result.source,
      };
      const nextHistory = [...optimisticHistory, assistantEntry];
      persistHistory(nextHistory);
      startTypingEffect(nextHistory.length - 1, assistantEntry.content);
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
          const retried = await sendChatMessage(
            userMessage,
            compactHistory,
            pendingImage ? toChatImageInput(pendingImage) : undefined,
          );
          const retryEntry: ChatMessage = {
            role: "assistant",
            content: retried.reply,
            source: retried.source,
          };
          const nextHistory = [...optimisticHistory, retryEntry];
          persistHistory(nextHistory);
          startTypingEffect(nextHistory.length - 1, retried.reply);
          return;
        } catch {
          // sigue al fallback visual
        }
      }

      setError("No fue posible responder ahora. Intenta de nuevo.");
      const fallbackEntry: ChatMessage = {
        role: "assistant",
        content:
          pendingImage
            ? "Recibi la imagen, pero no pude analizarla ahora. Prueba con una foto mas cercana, bien iluminada o mas pequeña."
            : "No tengo conexion con IA en este momento. Puedes preguntarme por bujia, bateria, frenos, aceite o sintomas de falla.",
        source: "local",
      };

      persistHistory([
        ...optimisticHistory,
        fallbackEntry,
      ]);
      startTypingEffect(optimisticHistory.length, fallbackEntry.content);
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
      {isChatVisible ? (
        <button
          type="button"
          className={`chat-backdrop ${closing ? "is-closing" : "is-open"}`}
          onMouseDown={closeChat}
          aria-label="Cerrar por fuera"
        />
      ) : null}
      {isChatVisible ? (
        <section className={`chat-shell ${closing ? "is-closing" : "is-open"}`}>
          <header className="chat-header">
            <div>
              <h1>Juan Mecánico AI</h1>
              <p>Asesor de piezas automotoras</p>
            </div>
            <div className="header-actions">
              <button type="button" className="icon-button" onClick={resetChat} aria-label="Nuevo chat">
                <RotateCcw size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={closeChat}
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
                <span>
                  {renderFormattedText(
                    typingState?.index === index ? typingState.text : entry.content,
                  )}
                  {typingState?.index === index ? (
                    <span className="typing-cursor" aria-hidden="true">
                      |
                    </span>
                  ) : null}
                </span>
                {entry.role === "assistant" && entry.source ? (
                  <span className={`source-pill source-${entry.source}`}>fuente: {entry.source}</span>
                ) : null}
              </article>
            ))}
            {loading && (
              <article className="bubble assistant typing-bubble" aria-live="polite" aria-label="Juan Mecánico AI está escribiendo">
                <span className="typing-label">Juan Mecánico AI está escribiendo</span>
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </article>
            )}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={onSubmit}>
            {selectedImage ? (
              <div className="image-preview">
                <img src={selectedImage.dataUrl} alt={selectedImage.name} />
                <div className="image-preview-meta">
                  <strong>{selectedImage.name}</strong>
                  <span>Imagen lista para enviar</span>
                </div>
                <button type="button" className="image-remove" onClick={clearSelectedImage} aria-label="Quitar imagen">
                  <X size={16} />
                </button>
              </div>
            ) : null}

            <div className="composer-row">
              <button
                type="button"
                className="attach-button"
                onClick={() => imageInputRef.current?.click()}
                disabled={loading}
                aria-label="Agregar foto"
              >
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={selectedImage ? "Agrega un comentario opcional..." : "Escribe tu pregunta..."}
                maxLength={600}
              />
              <button
                type="button"
                className={`mic-button ${isRecording ? "is-recording" : ""}`}
                onClick={toggleVoiceCapture}
                disabled={loading || isTranscribing}
                aria-label={isRecording ? "Detener grabación" : "Grabar voz"}
                title={isRecording ? "Detener grabación" : "Grabar voz"}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button type="submit" className="send-button" disabled={!canSend} aria-label="Enviar">
                <SendHorizontal size={16} />
              </button>
            </div>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              hidden
            />
          </form>

          {isRecording ? <p className="note voice-status">Grabando voz...</p> : null}
          {isTranscribing ? <p className="note voice-status">Transcribiendo audio...</p> : null}
          {voiceError ? <p className="error">{voiceError}</p> : null}
          {imageError ? <p className="error">{imageError}</p> : null}
          {error && <p className="error">{error}</p>}
          <p className="note">
            Respuestas orientativas. No reemplazan la revision de un mecanico calificado.
          </p>
        </section>
      ) : null}

      {!open ? (
        <button
          type="button"
          className="fab"
          onClick={openChat}
          aria-label="Abrir asesor"
        >
          <MessageCircle size={24} />
        </button>
      ) : null}
    </main>
  );

  return createPortal(widget, document.body);
}

export default App;
