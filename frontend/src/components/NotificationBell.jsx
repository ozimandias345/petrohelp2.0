import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { BellIcon } from "./Icons";

const INTERVALO_MS = 30000;

export default function NotificationBell({ align = "right" }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const contenedorRef = useRef(null);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function alHacerClickFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClickFuera);
    return () => document.removeEventListener("mousedown", alHacerClickFuera);
  }, []);

  function cargar() {
    client
      .get("/notificaciones/")
      .then((res) => setNotificaciones(res.data))
      .catch(() => {});
  }

  const noLeidas = notificaciones.filter((n) => !n.leido).length;

  function abrirNotificacion(n) {
    setAbierto(false);
    if (!n.leido) {
      setNotificaciones((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, leido: true } : x))
      );
      client.post(`/notificaciones/${n.id}/marcar_leida/`).catch(() => {});
    }
    navigate(`/tickets/${n.ticket}`);
  }

  async function marcarTodas(e) {
    e.stopPropagation();
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
    try {
      await client.post("/notificaciones/marcar_todas_leidas/");
    } catch {
      cargar();
    }
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative p-2 -m-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notificaciones"
      >
        <BellIcon />
        {noLeidas > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-ph-yellow text-ph-black text-[10px] font-bold flex items-center justify-center leading-none">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          className={`absolute mt-2 w-80 max-w-[85vw] bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {/* align="left": la campana está pegada al borde izquierdo de la
              pantalla (sidebar de escritorio), así que el menú se abre
              hacia la derecha en vez de salirse de la ventana. */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-xs font-mono uppercase tracking-wide text-muted">
              Notificaciones
            </span>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodas}
                className="text-xs text-ph-black underline decoration-ph-yellow decoration-2 underline-offset-2 hover:decoration-ph-black font-medium"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 && (
              <p className="text-sm text-muted text-center py-8">
                No tienes notificaciones.
              </p>
            )}
            {notificaciones.map((n) => (
              <button
                key={n.id}
                onClick={() => abrirNotificacion(n)}
                className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-surface-alt transition-colors ${
                  !n.leido ? "bg-ph-yellow-tint" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.leido && (
                    <span className="w-1.5 h-1.5 rounded-full bg-ph-black mt-1.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-ink-soft leading-snug">
                      {n.mensaje}
                    </p>
                    <p className="text-xs text-muted font-mono mt-1">
                      {new Date(n.fecha).toLocaleString("es-MX")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
