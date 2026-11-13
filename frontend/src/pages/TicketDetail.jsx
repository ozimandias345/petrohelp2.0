import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import { EstadoBadge, PrioridadBadge } from "../components/Badges";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";

const ESTADOS = ["abierto", "en_proceso", "cerrado"];
const INTERVALO_CHAT_MS = 15000;

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
      <path
        d="M3.5 5.5h13M8 5.5v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1m-6.5 0 .6 9.3a1.5 1.5 0 0 0 1.5 1.4h4.8a1.5 1.5 0 0 0 1.5-1.4l.6-9.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [estadoError, setEstadoError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [borrarError, setBorrarError] = useState("");

  // El operador puede abrir/dar seguimiento, pero no puede cerrar
  // ni borrar un ticket: eso le corresponde al admin de departamento o global.
  const puedeCerrar = user?.rol === "admin_departamento" || user?.rol === "admin_global";
  const puedeBorrar = puedeCerrar;

  async function borrarTicket() {
    setBorrando(true);
    setBorrarError("");
    try {
      await client.delete(`/tickets/${id}/`);
      navigate("/");
    } catch (err) {
      setBorrarError(
        err.response?.data?.detail || "No se pudo borrar el ticket."
      );
      setBorrando(false);
    }
  }

  useEffect(() => {
    cargar();
    // Se refresca solo cada ciertos segundos para que el seguimiento
    // se sienta como un chat (llegan mensajes de otros sin recargar).
    const intervalo = setInterval(cargar, INTERVALO_CHAT_MS);
    return () => clearInterval(intervalo);
  }, [id]);

  function cargar() {
    client
      .get(`/tickets/${id}/`)
      .then((res) => setTicket(res.data))
      .catch(() => {
        // Solo se muestra pantalla de error si nunca llegó a cargar el
        // ticket; si ya lo teníamos, un fallo pasajero del refresco
        // periódico no debe tirar la vista.
        setTicket((actual) => {
          if (!actual) {
            setError("No se pudo cargar este ticket, o no tienes acceso a él.");
          }
          return actual;
        });
      });
  }

  async function cambiarEstado(nuevoEstado) {
    setEstadoError("");
    try {
      await client.patch(`/tickets/${id}/`, { estado: nuevoEstado });
      cargar();
    } catch (err) {
      const detail =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        "No se pudo cambiar el estado.";
      setEstadoError(detail);
    }
  }

  async function enviarComentario(e) {
    e.preventDefault();
    if (!comentario.trim()) return;
    setEnviando(true);
    try {
      await client.post("/comentarios/", { ticket: id, comentario });
      setComentario("");
      cargar();
    } catch {
      setError("No se pudo agregar el comentario.");
    } finally {
      setEnviando(false);
    }
  }

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center">
        <p className="text-danger font-medium">{error}</p>
        <Link to="/" className="text-ph-black font-semibold text-sm mt-3 inline-block underline decoration-ph-yellow decoration-2 underline-offset-2">
          ← Volver a la lista
        </Link>
      </div>
    );
  }

  if (!ticket) {
    return <Spinner />;
  }

  return (
    <div className="max-w-3xl">
      <Link
        to="/"
        className="text-xs text-muted hover:text-ph-black font-mono uppercase tracking-wide"
      >
        ← Volver
      </Link>

      <div className="flex flex-wrap items-start justify-between mt-3 mb-1 gap-3">
        <h1 className="font-display text-xl sm:text-2xl font-semibold text-ink break-words">
          #{ticket.id} — {ticket.titulo}
        </h1>

        {puedeBorrar && !confirmarBorrado && (
          <button
            onClick={() => setConfirmarBorrado(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs text-muted hover:text-ph-black font-mono uppercase tracking-wide transition-colors mt-1"
          >
            <TrashIcon />
            Borrar
          </button>
        )}
        {puedeBorrar && confirmarBorrado && (
          <div className="shrink-0 flex items-center gap-2 mt-1">
            <span className="text-xs text-muted">¿Seguro?</span>
            <button
              onClick={borrarTicket}
              disabled={borrando}
              className="text-xs font-semibold text-ph-black bg-ph-yellow hover:bg-ph-yellow-dark px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
            >
              {borrando ? "Borrando…" : "Sí, borrar"}
            </button>
            <button
              onClick={() => setConfirmarBorrado(false)}
              disabled={borrando}
              className="text-xs font-medium text-muted hover:text-ink px-2.5 py-1 rounded-md transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {borrarError && (
        <p className="text-danger text-sm mb-3">{borrarError}</p>
      )}

      <div className="flex items-center gap-2 mb-6">
        <PrioridadBadge prioridad={ticket.prioridad} />
        <EstadoBadge estado={ticket.estado} />
        <span className="text-xs text-muted font-mono">
          {ticket.estacion_nombre} · {ticket.departamento_nombre}
        </span>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 mb-6 shadow-sm">
        <p className="text-ink-soft leading-relaxed">{ticket.descripcion}</p>

        {ticket.evidencia && (
          <a
            href={ticket.evidencia}
            target="_blank"
            rel="noreferrer"
            className="block mt-4"
          >
            <img
              src={ticket.evidencia}
              alt="Evidencia del problema"
              className="max-h-64 rounded-md border border-border object-cover hover:opacity-90 transition-opacity"
            />
          </a>
        )}

        <p className="text-xs text-muted mt-4 font-mono">
          Creado por {ticket.creado_por_nombre} el{" "}
          {new Date(ticket.fecha_registro).toLocaleString("es-MX")}
        </p>
      </div>

      {/* Cambiar estado */}
      <div className="mb-6">
        <p className="text-xs font-mono uppercase tracking-wide text-muted mb-2">
          Cambiar estado
        </p>
        <div className="flex gap-2">
          {ESTADOS.map((estado) => {
            const esCerrado = estado === "cerrado";
            const bloqueado = esCerrado && !puedeCerrar;
            return (
              <button
                key={estado}
                onClick={() => cambiarEstado(estado)}
                disabled={ticket.estado === estado || bloqueado}
                title={
                  bloqueado
                    ? "Solo un administrador de departamento o global puede cerrar un ticket."
                    : undefined
                }
                className={`px-3.5 py-2 rounded-md text-sm font-medium capitalize border transition-colors ${
                  ticket.estado === estado
                    ? "bg-border/40 border-border text-muted cursor-default"
                    : bloqueado
                    ? "border-border text-muted/50 cursor-not-allowed"
                    : "border-ph-black/30 text-ph-black hover:bg-ph-yellow-tint hover:border-ph-yellow"
                }`}
              >
                {estado.replace("_", " ")}
              </button>
            );
          })}
        </div>
        {!puedeCerrar && (
          <p className="text-xs text-muted mt-2">
            Solo un administrador de departamento o global puede cerrar este ticket.
          </p>
        )}
        {estadoError && (
          <p className="text-danger text-sm mt-2">{estadoError}</p>
        )}
      </div>

      {/* Chat de seguimiento */}
      <div className="mb-6">
        <p className="text-xs font-mono uppercase tracking-wide text-muted mb-3">
          Chat de seguimiento ({ticket.comentarios?.length || 0})
        </p>
        <div className="bg-surface border border-border rounded-lg shadow-sm">
          <div className="max-h-96 overflow-y-auto p-4 space-y-3">
            {ticket.comentarios?.length === 0 && (
              <p className="text-sm text-muted italic text-center py-6">
                Aún no hay mensajes. Escribe el primero abajo.
              </p>
            )}
            {ticket.comentarios?.map((c) => {
              const esPropio = c.usuario === user?.id;
              return (
                <div
                  key={c.id}
                  className={`flex ${esPropio ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3.5 py-2.5 ${
                      esPropio
                        ? "bg-ph-yellow text-ph-black rounded-br-sm"
                        : "bg-surface-alt text-ink-soft rounded-bl-sm border border-border"
                    }`}
                  >
                    {!esPropio && (
                      <p className="text-xs font-semibold text-ph-black mb-0.5">
                        {c.usuario_nombre}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {c.comentario}
                    </p>
                    <p
                      className={`text-[10px] font-mono mt-1 text-right ${
                        esPropio ? "text-white/70" : "text-muted"
                      }`}
                    >
                      {new Date(c.fecha).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            onSubmit={enviarComentario}
            className="flex gap-2 border-t border-border p-3"
          >
            <input
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe un mensaje…"
              className="flex-1 bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            />
            <button
              disabled={enviando || !comentario.trim()}
              className="bg-ph-yellow text-ph-black font-semibold text-sm px-4 rounded-md hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>

      {/* Historial */}
      <div>
        <p className="text-xs font-mono uppercase tracking-wide text-muted mb-3">
          Historial de cambios
        </p>
        {ticket.historial?.length === 0 && (
          <p className="text-sm text-muted italic">Sin cambios de estado todavía.</p>
        )}
        <div className="space-y-2">
          {ticket.historial?.map((h) => (
            <div key={h.id} className="flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-ph-yellow-dark shrink-0" />
              <span className="text-ink-soft">
                <span className="capitalize">{h.estado_anterior.replace("_", " ")}</span>
                {" → "}
                <span className="capitalize font-medium">
                  {h.estado_nuevo.replace("_", " ")}
                </span>
              </span>
              <span className="text-xs text-muted font-mono ml-auto">
                {new Date(h.fecha).toLocaleString("es-MX")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
