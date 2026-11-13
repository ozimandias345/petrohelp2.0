import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import agentClient from "../api/agentClient";

// PetroBot: chat flotante que consulta sensores/tickets y crea tickets.
// Habla con el agente FastAPI (/api/chat), que usa Claude con herramientas.

const SUGERENCIAS_ADMIN = [
  "¿Cómo están los sensores?",
  "Resume los tickets abiertos",
  "¿Qué alertas hubo hoy?",
];
const SUGERENCIAS_OPERADOR = [
  "Quiero reportar un problema",
  "¿Cómo van mis tickets?",
];

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.6" />
    </svg>
  );
}

function Burbuja({ m }) {
  const esUsuario = m.role === "user";
  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          esUsuario
            ? "bg-ph-yellow text-ph-black rounded-br-sm"
            : m.error
            ? "bg-danger-tint text-danger rounded-bl-sm"
            : "bg-surface-alt text-ink rounded-bl-sm"
        }`}
      >
        {m.content}
        {m.tickets?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.tickets.map((id) => (
              <Link key={id} to={`/tickets/${id}`}
                className="text-xs font-semibold bg-ph-black text-ph-yellow rounded px-2 py-0.5 hover:bg-ink-soft">
                Ver ticket #{id}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatBot({ user }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);

  const esAdmin = user?.rol === "admin_global" || user?.rol === "admin_departamento";
  const sugerencias = esAdmin ? SUGERENCIAS_ADMIN : SUGERENCIAS_OPERADOR;

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando, abierto]);

  async function enviar(contenido) {
    const limpio = (contenido ?? texto).trim();
    if (!limpio || enviando) return;
    const nuevos = [...mensajes, { role: "user", content: limpio }];
    setMensajes(nuevos);
    setTexto("");
    setEnviando(true);
    try {
      // Solo se mandan los mensajes válidos (sin los de error) al backend
      const historial = nuevos
        .filter((m) => !m.error)
        .map(({ role, content }) => ({ role, content }));
      const { data } = await agentClient.post("/chat", { mensajes: historial });
      setMensajes((prev) => [
        ...prev,
        { role: "assistant", content: data.respuesta, tickets: data.tickets_creados },
      ]);
    } catch (err) {
      const detalle =
        err.response?.data?.detail ||
        "No pude conectar con el agente (¿está corriendo en el puerto 8001?).";
      setMensajes((prev) => [...prev, { role: "assistant", content: detalle, error: true }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {abierto && (
        <div className="fixed z-50 bottom-20 right-4 left-4 sm:left-auto sm:w-96 h-[70vh] max-h-[560px] bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-surface-sidebar text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold tracking-wide leading-none">PetroBot</p>
              <p className="text-xs text-white/60 mt-1">Sensores, tickets y reportes</p>
            </div>
            <div className="flex items-center gap-3">
              {mensajes.length > 0 && (
                <button onClick={() => setMensajes([])}
                  className="text-xs text-white/60 hover:text-white font-mono uppercase">
                  Limpiar
                </button>
              )}
              <button onClick={() => setAbierto(false)} aria-label="Cerrar chat"
                className="text-white/70 hover:text-white text-xl leading-none">
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {mensajes.length === 0 && (
              <div className="text-sm text-muted">
                <p className="mb-3">
                  Hola {user?.first_name || user?.username}, soy PetroBot. ¿En qué te ayudo?
                </p>
                <div className="flex flex-col gap-1.5">
                  {sugerencias.map((s) => (
                    <button key={s} onClick={() => enviar(s)}
                      className="text-left text-sm text-ink bg-surface-alt hover:bg-ph-yellow-tint border border-border rounded-md px-3 py-2">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mensajes.map((m, i) => (
              <Burbuja key={i} m={m} />
            ))}
            {enviando && (
              <div className="flex justify-start">
                <div className="bg-surface-alt text-muted rounded-lg px-3 py-2 text-sm">Pensando…</div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="border-t border-border p-2.5 flex gap-2"
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu mensaje…"
              className="flex-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            />
            <button type="submit" disabled={enviando || !texto.trim()}
              className="bg-ph-yellow text-ph-black text-sm font-semibold px-4 rounded-md hover:bg-ph-yellow-dark disabled:opacity-50">
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setAbierto((a) => !a)}
        aria-label="Abrir PetroBot"
        className="fixed z-50 bottom-4 right-4 w-14 h-14 rounded-full bg-ph-yellow text-ph-black shadow-lg hover:bg-ph-yellow-dark flex items-center justify-center transition-colors"
      >
        {abierto ? <span className="text-2xl leading-none">×</span> : <ChatIcon />}
      </button>
    </>
  );
}
