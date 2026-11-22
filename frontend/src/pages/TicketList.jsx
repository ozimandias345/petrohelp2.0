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
  const [fEstado, setFEstado] = useState(""); // "" = todos
  const [fPrioridad, setFPrioridad] = useState("");
  const [fCategoria, setFCategoria] = useState("");

  // El admin_global no crea tickets: no tiene sentido que el
  // supervisor general reporte una incidencia sobre si mismo.
  const puedeCrearTicket = user?.rol !== "admin_global";
  const esOperador = user?.rol === "operador";

  useEffect(() => {
    cargarTickets();
    // Recargar cuando PetroBot crea un ticket desde el chat
    const recargar = () => cargarTickets(false);
    window.addEventListener("petrohelp:tickets-actualizados", recargar);
    return () => window.removeEventListener("petrohelp:tickets-actualizados", recargar);
  }, []);

  function cargarTickets(mostrarCarga = true) {
    if (mostrarCarga) setLoading(true);
    client
      .get("/tickets/")
      .then((res) => setTickets(res.data))
      .catch(() => setError("No se pudieron cargar los tickets."))
      .finally(() => setLoading(false));
  }

  const PRIORIDAD_PESO = { alta: 3, media: 2, baja: 1 };
  const ESTADO_PESO = { abierto: 1, en_proceso: 2, cerrado: 3 };

  // Categorías presentes en los tickets visibles (para el filtro)
  const categorias = [...new Set(tickets.map((t) => t.categoria_nombre).filter(Boolean))].sort();

  // Primero búsqueda + prioridad + categoría; el estado se aplica al final
  // para poder mostrar cuántos tickets hay en cada pestaña.
  const base = tickets.filter((t) => {
    const q = busqueda.toLowerCase();
    const coincide =
      t.titulo.toLowerCase().includes(q) || t.estacion_nombre?.toLowerCase().includes(q);
    return (
      coincide &&
      (!fPrioridad || t.prioridad === fPrioridad) &&
      (!fCategoria || t.categoria_nombre === fCategoria)
    );
  });
  const contar = (estado) => base.filter((t) => !estado || t.estado === estado).length;
  const contarPrioridad = (prioridad) =>
    tickets.filter((t) => {
      const q = busqueda.toLowerCase();
      const coincide =
        t.titulo.toLowerCase().includes(q) || t.estacion_nombre?.toLowerCase().includes(q);
      return (
        coincide &&
        (!fCategoria || t.categoria_nombre === fCategoria) &&
        (!fEstado || t.estado === fEstado) &&
        (!prioridad || t.prioridad === prioridad)
      );
    }).length;
  const hayFiltros = busqueda || fEstado || fPrioridad || fCategoria;

  function limpiarFiltros() {
    setBusqueda("");
    setFEstado("");
    setFPrioridad("");
    setFCategoria("");
  }

  const filtrados = base
    .filter((t) => !fEstado || t.estado === fEstado)
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

      {esOperador && <ResumenOperador tickets={tickets} user={user} />}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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

      {/* Pestañas de estado */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-mono uppercase tracking-wide text-muted mr-1">Estado</span>
        {[
          ["", "Todos", "bg-ph-black text-ph-yellow border-ph-black"],
          ["abierto", "Abiertos", "bg-danger text-white border-danger"],
          ["en_proceso", "En proceso", "bg-warn text-white border-warn"],
          ["cerrado", "Cerrados", "bg-success text-white border-success"],
        ].map(([valor, texto, activo]) => (
          <button
            key={valor || "todos"}
            type="button"
            onClick={() => setFEstado(valor)}
            className={`inline-flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
              fEstado === valor ? activo : "bg-surface border-border text-ink-soft hover:border-ph-yellow"
            }`}
          >
            {texto}
            <span
              className={`text-xs font-mono px-1.5 rounded ${
                fEstado === valor ? "bg-white/20" : "bg-surface-alt text-muted"
              }`}
            >
              {contar(valor)}
            </span>
          </button>
        ))}
      </div>

      {/* Prioridad y categoría */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wide text-muted mr-1">Prioridad</span>
          {[
            ["", "Todas", "bg-ph-black text-ph-yellow border-ph-black"],
            ["alta", "Alta", "bg-danger text-white border-danger"],
            ["media", "Media", "bg-warn text-white border-warn"],
            ["baja", "Baja", "bg-success text-white border-success"],
          ].map(([valor, texto, activo]) => (
            <button
              key={valor || "todas"}
              type="button"
              onClick={() => setFPrioridad(valor)}
              className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
                fPrioridad === valor ? activo : "bg-surface border-border text-ink-soft hover:border-ph-yellow"
              }`}
            >
              {texto}
              <span
                className={`text-xs font-mono px-1.5 rounded ${
                  fPrioridad === valor ? "bg-white/20" : "bg-surface-alt text-muted"
                }`}
              >
                {contarPrioridad(valor)}
              </span>
            </button>
          ))}
        </div>
        <select
          value={fCategoria}
          onChange={(e) => setFCategoria(e.target.value)}
          className="bg-surface border border-border rounded-md px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow sm:w-56"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="text-sm font-medium text-ink-soft hover:text-ph-black underline decoration-ph-yellow decoration-2 underline-offset-2 sm:ml-1 self-start sm:self-auto"
          >
            Limpiar filtros
          </button>
        )}
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

// Resumen de bienvenida para el operador: al entrar quiere saber en qué
// van sus reportes, no ver una lista con filtros.
function ResumenOperador({ tickets, user }) {
  const abiertos = tickets.filter((t) => t.estado === "abierto").length;
  const enProceso = tickets.filter((t) => t.estado === "en_proceso").length;
  const cerrados = tickets.filter((t) => t.estado === "cerrado").length;
  const sinAtender = tickets.filter((t) => t.estado === "abierto" && !t.asignado_a).length;

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const nombre = user?.first_name || user?.username;

  return (
    <div className="bg-surface-sidebar text-white rounded-lg p-5 mb-5 relative overflow-hidden">
      <div className="hazard-stripes absolute top-0 inset-x-0 h-1.5" />
      <div className="flex flex-wrap items-center justify-between gap-4 mt-1">
        <div>
          <p className="font-display text-xl font-semibold tracking-wide">
            {saludo}, {nombre}.
          </p>
          <p className="text-sm text-white/60 mt-1">
            {tickets.length === 0
              ? "Todavía no has reportado ninguna incidencia."
              : enProceso > 0
              ? `Hay ${enProceso} de tus reportes en atención ahora mismo.`
              : abiertos > 0
              ? `Tienes ${abiertos} reporte(s) esperando a que alguien los tome.`
              : "Todos tus reportes están cerrados."}
          </p>
        </div>

        <div className="flex gap-5">
          {[
            ["Abiertos", abiertos, "text-ph-yellow"],
            ["En proceso", enProceso, "text-white"],
            ["Cerrados", cerrados, "text-success"],
          ].map(([etiqueta, valor, color]) => (
            <div key={etiqueta} className="text-center">
              <p className={`font-display text-3xl font-semibold ${color}`}>{valor}</p>
              <p className="text-[11px] font-mono uppercase tracking-wide text-white/50 mt-0.5">
                {etiqueta}
              </p>
            </div>
          ))}
        </div>
      </div>

      {sinAtender > 0 && (
        <p className="text-xs text-white/50 mt-4 border-t border-white/10 pt-3">
          {sinAtender === 1
            ? "Uno de tus reportes aún no tiene responsable asignado."
            : `${sinAtender} de tus reportes aún no tienen responsable asignado.`}{" "}
          Si es urgente, avisa a tu supervisor.
        </p>
      )}
    </div>
  );
}