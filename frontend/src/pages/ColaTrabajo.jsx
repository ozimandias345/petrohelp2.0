import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";

// Cola de trabajo del administrador de departamento (y del global).
// Responde tres preguntas: qué falta repartir, qué se está atorando,
// y cómo está repartida la carga entre el equipo.

const DIAS_ESTANCADO = 3;

function dias(desde) {
  if (!desde) return 0;
  return Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);
}

function antiguedad(desde) {
  const d = dias(desde);
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  return `hace ${d} días`;
}

const COLOR_PRIORIDAD = {
  alta: "bg-danger-tint text-danger border-danger/30",
  media: "bg-ph-yellow-tint text-ph-black border-ph-yellow/40",
  baja: "bg-surface-alt text-muted border-border",
};

function Fila({ t, usuarios, onAsignar, asignando }) {
  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-surface-alt transition-colors">
      <span
        className={`shrink-0 text-[11px] font-mono uppercase px-2 py-0.5 rounded-full border ${
          COLOR_PRIORIDAD[t.prioridad] || COLOR_PRIORIDAD.baja
        }`}
      >
        {t.prioridad}
      </span>

      <div className="flex-1 min-w-[200px]">
        <Link to={`/tickets/${t.id}`} className="text-sm font-medium text-ink hover:underline">
          #{t.id} {t.titulo}
        </Link>
        <p className="text-xs text-muted">
          {t.estacion_nombre || "Sin estación"} · {t.categoria_nombre} · abierto {antiguedad(t.fecha_registro)}
        </p>
      </div>

      <select
        value={t.asignado_a || ""}
        disabled={asignando === t.id}
        onChange={(e) => onAsignar(t, e.target.value ? Number(e.target.value) : null)}
        className="shrink-0 bg-surface-alt border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ph-yellow"
      >
        <option value="">— Sin asignar —</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.first_name || u.username}
          </option>
        ))}
      </select>
    </div>
  );
}

function Bloque({ titulo, descripcion, tickets, children, vacio }) {
  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink tracking-wide">{titulo}</h2>
          <span className="text-xs font-mono text-muted">{tickets.length}</span>
        </div>
        <p className="text-xs text-muted mt-0.5">{descripcion}</p>
      </div>
      {tickets.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-soft">{vacio}</p>
      ) : (
        <div className="divide-y divide-border">{children}</div>
      )}
    </section>
  );
}

export default function ColaTrabajo() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asignando, setAsignando] = useState(null);

  useEffect(() => {
    Promise.all([
      client.get("/tickets/"),
      client.get("/usuarios/").catch(() => ({ data: [] })),
    ])
      .then(([t, u]) => {
        setTickets(t.data);
        setUsuarios(u.data.filter((x) => x.activo && x.rol !== "admin_global"));
      })
      .catch(() => setError("No se pudo cargar la cola de trabajo."))
      .finally(() => setLoading(false));
  }, []);

  async function asignar(ticket, usuarioId) {
    setAsignando(ticket.id);
    setError("");
    try {
      const res = await client.patch(`/tickets/${ticket.id}/`, { asignado_a: usuarioId });
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...res.data } : t)));
    } catch {
      setError("No se pudo asignar la incidencia.");
    } finally {
      setAsignando(null);
    }
  }

  const abiertos = useMemo(
    () => tickets.filter((t) => t.estado !== "cerrado"),
    [tickets]
  );

  const sinAsignar = useMemo(
    () =>
      abiertos
        .filter((t) => !t.asignado_a)
        .sort((a, b) => new Date(a.fecha_registro) - new Date(b.fecha_registro)),
    [abiertos]
  );

  const estancados = useMemo(
    () =>
      abiertos
        .filter((t) => t.asignado_a && dias(t.fecha_actualizacion) >= DIAS_ESTANCADO)
        .sort((a, b) => new Date(a.fecha_actualizacion) - new Date(b.fecha_actualizacion)),
    [abiertos]
  );

  const carga = useMemo(() => {
    const mapa = new Map();
    usuarios.forEach((u) => mapa.set(u.id, { usuario: u, total: 0, altas: 0 }));
    abiertos.forEach((t) => {
      if (!t.asignado_a) return;
      const fila = mapa.get(t.asignado_a);
      if (!fila) return;
      fila.total += 1;
      if (t.prioridad === "alta") fila.altas += 1;
    });
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [abiertos, usuarios]);

  const maxCarga = Math.max(1, ...carga.map((c) => c.total));

  if (loading) return <Spinner full />;

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">
        Cola de trabajo
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        {user?.rol === "admin_global"
          ? "Incidencias abiertas de todas las estaciones."
          : `Incidencias abiertas de ${user?.departamento_nombre || "tu departamento"}.`}
      </p>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div>
          <Bloque
            titulo="Sin asignar"
            descripcion="Lo más antiguo primero. Elige un responsable en el desplegable."
            tickets={sinAsignar}
            vacio="Todo está repartido. Buen trabajo."
          >
            {sinAsignar.map((t) => (
              <Fila key={t.id} t={t} usuarios={usuarios} onAsignar={asignar} asignando={asignando} />
            ))}
          </Bloque>

          <Bloque
            titulo="Sin movimiento"
            descripcion={`Asignadas pero sin cambios desde hace ${DIAS_ESTANCADO} días o más.`}
            tickets={estancados}
            vacio="Ninguna incidencia lleva días detenida."
          >
            {estancados.map((t) => (
              <div key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="shrink-0 text-[11px] font-mono uppercase px-2 py-0.5 rounded-full border bg-danger-tint text-danger border-danger/30">
                  {dias(t.fecha_actualizacion)} días
                </span>
                <div className="flex-1 min-w-[200px]">
                  <Link
                    to={`/tickets/${t.id}`}
                    className="text-sm font-medium text-ink hover:underline"
                  >
                    #{t.id} {t.titulo}
                  </Link>
                  <p className="text-xs text-muted">
                    {t.asignado_a_nombre || "sin responsable"} · {t.estado.replace("_", " ")}
                  </p>
                </div>
              </div>
            ))}
          </Bloque>
        </div>

        <aside className="bg-surface border border-border rounded-lg p-4">
          <p className="text-xs font-mono uppercase tracking-wide text-muted mb-3">
            Carga por responsable
          </p>
          {carga.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay personal registrado.</p>
          ) : (
            <ul className="space-y-3">
              {carga.map(({ usuario, total, altas }) => (
                <li key={usuario.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink truncate">
                      {usuario.first_name || usuario.username}
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {total}
                      {altas > 0 && <span className="text-danger font-medium"> · {altas} alta</span>}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-alt rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-ph-yellow rounded-full"
                      style={{ width: `${(total / maxCarga) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted mt-4 leading-snug">
            Cuenta sólo incidencias abiertas o en proceso.
          </p>
        </aside>
      </div>
    </div>
  );
}
