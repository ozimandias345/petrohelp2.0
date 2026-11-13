import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { PriorityBar, EstadoBadge, PrioridadBadge } from "../components/Badges";
import { useAuth } from "../context/AuthContext";

export default function TicketList() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("recientes");

  // El admin_global no crea tickets: no tiene sentido que el
  // supervisor general reporte una incidencia sobre si mismo.
  const puedeCrearTicket = user?.rol !== "admin_global";

  useEffect(() => {
    cargarTickets();
  }, []);

  function cargarTickets() {
    setLoading(true);
    client
      .get("/tickets/")
      .then((res) => setTickets(res.data))
      .catch(() => setError("No se pudieron cargar los tickets."))
      .finally(() => setLoading(false));
  }

  const PRIORIDAD_PESO = { alta: 3, media: 2, baja: 1 };
  const ESTADO_PESO = { abierto: 1, en_proceso: 2, cerrado: 3 };

  const filtrados = tickets
    .filter(
      (t) =>
        t.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.estacion_nombre?.toLowerCase().includes(busqueda.toLowerCase())
    )
    .sort((a, b) => {
      switch (orden) {
        case "antiguos":
          return new Date(a.fecha_registro) - new Date(b.fecha_registro);
        case "prioridad":
          return (PRIORIDAD_PESO[b.prioridad] || 0) - (PRIORIDAD_PESO[a.prioridad] || 0);
        case "estado":
          return (ESTADO_PESO[a.estado] || 0) - (ESTADO_PESO[b.estado] || 0);
        case "recientes":
        default:
          return new Date(b.fecha_registro) - new Date(a.fecha_registro);
      }
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">
            Tickets
          </h1>
          <p className="text-sm text-muted mt-1">
            {loading ? "Cargando…" : `${filtrados.length} ticket(s) visibles para tu rol`}
          </p>
        </div>
        {puedeCrearTicket && (
          <Link
            to="/tickets/nuevo"
            className="bg-ph-yellow text-ph-black font-semibold text-sm px-4 py-2.5 rounded-md hover:bg-ph-yellow-dark transition-colors"
          >
            + Nuevo ticket
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por título o estación…"
          className="flex-1 bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-ink placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-ph-yellow"
        />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          className="bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow sm:w-56"
        >
          <option value="recientes">Más recientes primero</option>
          <option value="antiguos">Más antiguos primero</option>
          <option value="prioridad">Prioridad (alta a baja)</option>
          <option value="estado">Estado (abierto a cerrado)</option>
        </select>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {!loading && filtrados.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-10 text-center">
          <p className="text-ink-soft font-medium">No hay tickets que mostrar.</p>
          <p className="text-muted text-sm mt-1">
            {puedeCrearTicket
              ? "Crea uno nuevo o ajusta tu búsqueda."
              : "Ajusta tu búsqueda."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtrados.map((ticket) => (
          <Link
            key={ticket.id}
            to={`/tickets/${ticket.id}`}
            className="flex items-stretch gap-4 bg-surface border border-border rounded-lg px-4 py-3.5 hover:border-ph-yellow hover:bg-ph-yellow-tint/60 hover:shadow-sm transition-all"
          >
            <PriorityBar prioridad={ticket.prioridad} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted">
                  #{ticket.id}
                </span>
                <h3 className="font-medium text-ink truncate">
                  {ticket.titulo}
                </h3>
              </div>
              <p className="text-xs text-muted mt-1">
                {ticket.estacion_nombre} · {ticket.departamento_nombre} · creado por{" "}
                {ticket.creado_por_nombre}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PrioridadBadge prioridad={ticket.prioridad} />
              <EstadoBadge estado={ticket.estado} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}