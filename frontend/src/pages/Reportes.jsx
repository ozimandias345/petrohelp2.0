import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

// Reportes exportables (PDF / Excel) de incidencias.
// Cada rol descarga solo lo que puede ver en el sistema.

const hoyISO = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD local

function rango(tipo) {
  const h = new Date();
  const iso = (d) => d.toLocaleDateString("en-CA");
  switch (tipo) {
    case "mes":
      return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)];
    case "mes_pasado":
      return [
        iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
        iso(new Date(h.getFullYear(), h.getMonth(), 0)),
      ];
    case "30":
      return [iso(new Date(h.getTime() - 29 * 86400000)), iso(h)];
    case "anio":
      return [iso(new Date(h.getFullYear(), 0, 1)), iso(h)];
    default:
      return ["", ""];
  }
}

const RAPIDOS = [
  ["mes", "Este mes"],
  ["mes_pasado", "Mes pasado"],
  ["30", "Últimos 30 días"],
  ["anio", "Este año"],
  ["todo", "Todo"],
];

const campo =
  "w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow";

export default function Reportes() {
  const { user } = useAuth();
  const [estaciones, setEstaciones] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [f, setF] = useState(() => {
    const [desde, hasta] = rango("mes");
    return { desde, hasta, estacion: "", departamento: "", estado: "", prioridad: "", detalle: true };
  });
  const [rapido, setRapido] = useState("mes");
  const [descargando, setDescargando] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/estaciones/").then((r) => setEstaciones(r.data)).catch(() => {});
    if (user?.rol === "admin_global") {
      client.get("/departamentos/").then((r) => setDepartamentos(r.data)).catch(() => {});
    }
  }, [user]);

  function set(nombre, valor) {
    setF((prev) => ({ ...prev, [nombre]: valor }));
    if (nombre === "desde" || nombre === "hasta") setRapido("");
  }

  function elegirRapido(tipo) {
    const [desde, hasta] = rango(tipo);
    setF((prev) => ({ ...prev, desde, hasta }));
    setRapido(tipo);
  }

  async function descargar(formato) {
    setError("");
    if (f.desde && f.hasta && f.desde > f.hasta) {
      setError("La fecha inicial no puede ser mayor que la final.");
      return;
    }
    setDescargando(formato);
    try {
      const params = { formato, detalle: f.detalle ? "1" : "0" };
      ["desde", "hasta", "estacion", "departamento", "estado", "prioridad"].forEach((k) => {
        if (f[k]) params[k] = f[k];
      });
      const res = await client.get("/reportes/incidencias/", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PetroHelp_incidencias_${f.desde || "inicio"}_a_${f.hasta || hoyISO()}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError("No se pudo generar el reporte. Revisa que el backend esté corriendo.");
    } finally {
      setDescargando("");
    }
  }

  const alcance =
    user?.rol === "admin_global"
      ? "Incluye todas las estaciones y departamentos."
      : user?.rol === "admin_departamento"
      ? `Incluye los tickets de ${user?.departamento_nombre || "tu departamento"}.`
      : "Incluye los tickets que tú registraste.";

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">Reportes</h1>
        <p className="text-sm text-muted mt-1">
          Exporta la bitácora de incidencias en PDF o Excel para auditorías y control interno (SASISOPA).
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Filtros */}
        <div className="bg-surface border border-border rounded-lg p-5 sm:p-6">
          <p className="text-xs font-mono uppercase tracking-wide text-muted mb-3">Periodo</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {RAPIDOS.map(([k, t]) => (
              <button
                key={k}
                type="button"
                onClick={() => elegirRapido(k)}
                className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                  rapido === k
                    ? "bg-ph-black text-ph-yellow border-ph-black"
                    : "border-border text-ink-soft hover:border-ph-yellow hover:bg-ph-yellow-tint"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <label className="text-sm text-ink-soft">
              Desde
              <input type="date" value={f.desde} max={hoyISO()} onChange={(e) => set("desde", e.target.value)} className={`${campo} mt-1`} />
            </label>
            <label className="text-sm text-ink-soft">
              Hasta
              <input type="date" value={f.hasta} max={hoyISO()} onChange={(e) => set("hasta", e.target.value)} className={`${campo} mt-1`} />
            </label>
          </div>

          <p className="text-xs font-mono uppercase tracking-wide text-muted mb-3">Filtros</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm text-ink-soft">
              Estación
              <select value={f.estacion} onChange={(e) => set("estacion", e.target.value)} className={`${campo} mt-1`}>
                <option value="">Todas</option>
                {estaciones.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </label>
            {user?.rol === "admin_global" && (
              <label className="text-sm text-ink-soft">
                Departamento
                <select value={f.departamento} onChange={(e) => set("departamento", e.target.value)} className={`${campo} mt-1`}>
                  <option value="">Todos</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm text-ink-soft">
              Estado
              <select value={f.estado} onChange={(e) => set("estado", e.target.value)} className={`${campo} mt-1`}>
                <option value="">Todos</option>
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En proceso</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </label>
            <label className="text-sm text-ink-soft">
              Prioridad
              <select value={f.prioridad} onChange={(e) => set("prioridad", e.target.value)} className={`${campo} mt-1`}>
                <option value="">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>
          </div>

          <label className="flex items-start gap-3 mt-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={f.detalle}
              onChange={(e) => set("detalle", e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#ffc400]"
            />
            <span className="text-sm text-ink">
              Incluir bitácora detallada
              <span className="block text-xs text-muted mt-0.5">
                Descripción, cambios de estado y comentarios de cada incidencia (en el PDF).
              </span>
            </span>
          </label>
        </div>

        {/* Descargas */}
        <div className="bg-surface-sidebar text-white rounded-lg p-5 sm:p-6 relative overflow-hidden">
          <div className="hazard-stripes absolute top-0 inset-x-0 h-1.5" />
          <p className="text-xs font-mono uppercase tracking-wide text-ph-yellow mt-1 mb-2">Descargar</p>
          <p className="text-sm text-white/70 mb-5">{alcance}</p>

          <button
            onClick={() => descargar("pdf")}
            disabled={!!descargando}
            className="w-full flex items-center gap-3 bg-ph-yellow text-ph-black font-semibold rounded-md px-4 py-3 hover:bg-ph-yellow-dark transition-colors disabled:opacity-60 mb-3"
          >
            <span className="w-9 h-9 rounded bg-ph-black text-ph-yellow text-xs font-bold flex items-center justify-center">PDF</span>
            <span className="text-left">
              {descargando === "pdf" ? "Generando…" : "Reporte en PDF"}
              <span className="block text-xs font-normal opacity-75">Para imprimir, firmar y archivar</span>
            </span>
          </button>

          <button
            onClick={() => descargar("xlsx")}
            disabled={!!descargando}
            className="w-full flex items-center gap-3 bg-white/10 text-white font-semibold rounded-md px-4 py-3 hover:bg-white/15 border border-white/15 transition-colors disabled:opacity-60"
          >
            <span className="w-9 h-9 rounded bg-success text-white text-xs font-bold flex items-center justify-center">XLS</span>
            <span className="text-left">
              {descargando === "xlsx" ? "Generando…" : "Reporte en Excel"}
              <span className="block text-xs font-normal opacity-70">Para analizar, filtrar y hacer gráficas</span>
            </span>
          </button>

          {error && <p className="text-sm text-ph-yellow mt-4">{error}</p>}

          <ul className="mt-6 space-y-1.5 text-xs text-white/60">
            <li>• Resumen: totales, estados, prioridades y tiempo promedio de cierre</li>
            <li>• Listado completo de incidencias del periodo</li>
            <li>• Espacio para firmas (Elaboró / Revisó / Responsable SASISOPA)</li>
            <li>• Excel con hojas de resumen, incidencias, historial y comentarios</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
