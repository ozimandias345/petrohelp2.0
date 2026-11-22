import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Spinner from "../components/Spinner";

// Bitácora de actividad: todos los cambios de estado y comentarios del
// sistema en una sola lista, con quién lo hizo y cuándo. Es lo que se
// enseña en una auditoría cuando preguntan "¿quién movió esto?".

const campo =
  "bg-surface-alt border border-border rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow";

const NOMBRE_ESTADO = { abierto: "Abierto", en_proceso: "En proceso", cerrado: "Cerrado" };

function fechaISO(d) {
  return d.toLocaleDateString("en-CA");
}

export default function Auditoria() {
  const [historial, setHistorial] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [desde, setDesde] = useState(() =>
    fechaISO(new Date(Date.now() - 29 * 86400000))
  );
  const [hasta, setHasta] = useState(() => fechaISO(new Date()));
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    Promise.all([
      client.get("/historial/"),
      client.get("/comentarios/"),
      client.get("/tickets/"),
    ])
      .then(([h, c, t]) => {
        setHistorial(h.data);
        setComentarios(c.data);
        setTickets(t.data);
      })
      .catch(() => setError("No se pudo cargar la bitácora."))
      .finally(() => setLoading(false));
  }, []);

  const titulos = useMemo(() => {
    const m = new Map();
    tickets.forEach((t) => m.set(t.id, t.titulo));
    return m;
  }, [tickets]);

  const eventos = useMemo(() => {
    const lista = [
      ...historial.map((h) => ({
        id: `h-${h.id}`,
        tipo: "estado",
        ticket: h.ticket,
        quien: h.usuario_nombre || `usuario ${h.usuario}`,
        fecha: h.fecha,
        texto: `Cambió el estado de ${
          NOMBRE_ESTADO[h.estado_anterior] || h.estado_anterior
        } a ${NOMBRE_ESTADO[h.estado_nuevo] || h.estado_nuevo}`,
      })),
      ...comentarios.map((c) => ({
        id: `c-${c.id}`,
        tipo: "comentario",
        ticket: c.ticket,
        quien: c.usuario_nombre || `usuario ${c.usuario}`,
        fecha: c.fecha,
        texto: `Comentó: “${c.comentario}”`,
      })),
    ];
    return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [historial, comentarios]);

  const filtrados = useMemo(() => {
    const d = desde ? new Date(`${desde}T00:00:00`) : null;
    const h = hasta ? new Date(`${hasta}T23:59:59`) : null;
    const q = busqueda.trim().toLowerCase();
    return eventos.filter((e) => {
      const f = new Date(e.fecha);
      if (d && f < d) return false;
      if (h && f > h) return false;
      if (tipo && e.tipo !== tipo) return false;
      if (q) {
        const texto = `${e.quien} ${e.texto} ${titulos.get(e.ticket) || ""} #${e.ticket}`;
        if (!texto.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [eventos, desde, hasta, tipo, busqueda, titulos]);

  function descargarCsv() {
    const filas = [
      ["Fecha", "Usuario", "Incidencia", "Titulo", "Tipo", "Detalle"],
      ...filtrados.map((e) => [
        new Date(e.fecha).toLocaleString("es-MX"),
        e.quien,
        `#${e.ticket}`,
        titulos.get(e.ticket) || "",
        e.tipo === "estado" ? "Cambio de estado" : "Comentario",
        e.texto,
      ]),
    ];
    const csv = filas
      .map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `PetroHelp_bitacora_${desde || "inicio"}_a_${hasta || "hoy"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  if (loading) return <Spinner full />;

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">
        Bitácora de actividad
      </h1>
      <p className="text-sm text-muted mt-1 mb-5">
        Quién cambió qué y cuándo, en todas las incidencias que puedes ver.
      </p>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="bg-surface border border-border rounded-lg p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs text-muted">
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${campo} block mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={`${campo} block mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${campo} block mt-1`}>
              <option value="">Todo</option>
              <option value="estado">Cambios de estado</option>
              <option value="comentario">Comentarios</option>
            </select>
          </label>
          <label className="text-xs text-muted flex-1 min-w-[180px]">
            Buscar
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Usuario, incidencia o texto"
              className={`${campo} block mt-1 w-full`}
            />
          </label>
          <button
            onClick={descargarCsv}
            disabled={filtrados.length === 0}
            className="bg-ph-black text-ph-yellow font-semibold text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Descargar CSV
          </button>
        </div>
        <p className="text-xs text-muted mt-3">
          {filtrados.length} movimiento(s) en el periodo.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-soft">
            No hay movimientos con esos filtros.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtrados.map((e) => (
              <li key={e.id} className="px-4 py-3 flex flex-wrap gap-x-3 gap-y-1 items-baseline">
                <span
                  className={`shrink-0 text-[11px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                    e.tipo === "estado"
                      ? "bg-ph-yellow-tint text-ph-black border-ph-yellow/40"
                      : "bg-surface-alt text-muted border-border"
                  }`}
                >
                  {e.tipo === "estado" ? "Estado" : "Comentario"}
                </span>
                <span className="text-sm text-ink flex-1 min-w-[220px]">
                  <span className="font-medium">{e.quien}</span> · {e.texto}
                </span>
                <Link
                  to={`/tickets/${e.ticket}`}
                  className="text-xs text-muted hover:text-ink underline decoration-ph-yellow decoration-2 underline-offset-2"
                >
                  #{e.ticket} {titulos.get(e.ticket) || ""}
                </Link>
                <span className="text-xs text-muted font-mono">
                  {new Date(e.fecha).toLocaleString("es-MX")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted mt-4 leading-relaxed">
        La bitácora registra la actividad sobre las incidencias. Los cambios de
        catálogos y de cuentas quedan en el panel de administración de Django.
      </p>
    </div>
  );
}
