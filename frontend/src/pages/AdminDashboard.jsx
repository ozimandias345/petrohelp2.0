import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import client from "../api/client";
import agentClient from "../api/agentClient";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";

const ESTADO_COLORS = { abierto: "#d92d20", en_proceso: "#e08a1e", cerrado: "#1f9d63" };
const PRIORIDAD_COLORS = { alta: "#d92d20", media: "#e08a1e", baja: "#1f9d63" };

function StatCard({ label, value, accent }) {
  return (
    <div className="relative bg-surface border border-border rounded-lg p-5 shadow-sm overflow-hidden">
      <span
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: accent || "#d4d4d8" }}
      />
      <p className="text-xs font-mono uppercase tracking-wide text-muted mb-2">
        {label}
      </p>
      <p
        className="font-display text-4xl font-semibold"
        style={{ color: accent || "#1a1a1a" }}
      >
        {value}
      </p>
    </div>
  );
}

// Alertas de sensores que generaron ticket automáticamente en los
// últimos 30 días: problemas detectados antes de que alguien los reportara.
function TarjetaPrevencion({ alertas }) {
  const hace30 = Date.now() - 30 * 24 * 3600 * 1000;
  const recientes = alertas.filter((a) => new Date(a.ts).getTime() >= hace30);
  const aTiempo = recientes.filter((a) => a.ticket_id);
  const riesgoAlto = aTiempo.filter((a) => a.severidad === "alta").length;

  return (
    <div className="bg-surface-sidebar text-white rounded-lg p-5 sm:p-6 mb-6 shadow-sm relative overflow-hidden">
      <span className="absolute top-0 left-0 bottom-0 w-1.5 bg-ph-yellow" />
      <p className="text-xs font-mono uppercase tracking-wide text-ph-yellow mb-3">
        Prevención · últimos 30 días
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <p className="font-display text-5xl font-semibold leading-none">{aTiempo.length}</p>
          <p className="text-sm text-white/70 mt-2">
            Alertas detectadas a tiempo por los sensores, con ticket automático
          </p>
        </div>
        <div>
          <p className="font-display text-5xl font-semibold leading-none text-ph-yellow">{riesgoAlto}</p>
          <p className="text-sm text-white/70 mt-2">De riesgo alto atendidas antes de un reporte manual</p>
        </div>
        <div>
          <p className="font-display text-5xl font-semibold leading-none">{recientes.length}</p>
          <p className="text-sm text-white/70 mt-2">Lecturas fuera de rango vigiladas en total</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState(null); // null = agente no disponible

  useEffect(() => {
    client
      .get("/tickets/")
      .then((res) => setTickets(res.data))
      .finally(() => setLoading(false));
    agentClient
      .get("/alertas?limite=500")
      .then((res) => setAlertas(res.data))
      .catch(() => setAlertas(null));
  }, []);

  if (loading) return <Spinner />;

  const total = tickets.length;
  const abiertos = tickets.filter((t) => t.estado === "abierto").length;
  const enProceso = tickets.filter((t) => t.estado === "en_proceso").length;
  const cerrados = tickets.filter((t) => t.estado === "cerrado").length;

  const porEstado = [
    { name: "Abierto", value: abiertos, key: "abierto" },
    { name: "En proceso", value: enProceso, key: "en_proceso" },
    { name: "Cerrado", value: cerrados, key: "cerrado" },
  ].filter((d) => d.value > 0);

  const porDepartamento = Object.values(
    tickets.reduce((acc, t) => {
      const key = t.departamento_nombre || "Sin depto";
      acc[key] = acc[key] || { departamento: key, cantidad: 0 };
      acc[key].cantidad += 1;
      return acc;
    }, {})
  );

  // --- Comparativa por estación: cuántas incidencias genera cada una
  // y cuánto tarda en cerrarlas. Responde "¿cuál me está dando lata?".
  const porEstacion = Object.values(
    tickets.reduce((acc, t) => {
      const nombre = t.estacion_nombre || "Sin estación";
      if (!acc[nombre]) acc[nombre] = { estacion: nombre, abiertas: 0, cerradas: 0, dias: [] };
      if (t.estado === "cerrado") {
        acc[nombre].cerradas += 1;
        if (t.fecha_cierre) {
          const d =
            (new Date(t.fecha_cierre) - new Date(t.fecha_registro)) / 86400000;
          if (d >= 0) acc[nombre].dias.push(d);
        }
      } else {
        acc[nombre].abiertas += 1;
      }
      return acc;
    }, {})
  )
    .map((e) => ({
      ...e,
      total: e.abiertas + e.cerradas,
      promedio: e.dias.length
        ? Number((e.dias.reduce((a, b) => a + b, 0) / e.dias.length).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // --- Tendencia: incidencias registradas por semana, últimas 8 semanas.
  const tendencia = (() => {
    const semanas = [];
    const hoy = new Date();
    for (let i = 7; i >= 0; i--) {
      const fin = new Date(hoy.getTime() - i * 7 * 86400000);
      const inicio = new Date(fin.getTime() - 6 * 86400000);
      semanas.push({
        etiqueta: `${inicio.getDate()}/${inicio.getMonth() + 1}`,
        inicio: new Date(inicio.setHours(0, 0, 0, 0)),
        fin: new Date(fin.setHours(23, 59, 59, 999)),
        registradas: 0,
        cerradas: 0,
      });
    }
    tickets.forEach((t) => {
      const alta = new Date(t.fecha_registro);
      const cierre = t.fecha_cierre ? new Date(t.fecha_cierre) : null;
      semanas.forEach((s) => {
        if (alta >= s.inicio && alta <= s.fin) s.registradas += 1;
        if (cierre && cierre >= s.inicio && cierre <= s.fin) s.cerradas += 1;
      });
    });
    return semanas;
  })();

  // Tiempo promedio de cierre, en días, sobre todo lo cerrado.
  const promedioCierre = (() => {
    const dias = tickets
      .filter((t) => t.estado === "cerrado" && t.fecha_cierre)
      .map((t) => (new Date(t.fecha_cierre) - new Date(t.fecha_registro)) / 86400000)
      .filter((d) => d >= 0);
    if (!dias.length) return null;
    return (dias.reduce((a, b) => a + b, 0) / dias.length).toFixed(1);
  })();

  const porPrioridad = [
    { name: "Alta", value: tickets.filter((t) => t.prioridad === "alta").length, key: "alta" },
    { name: "Media", value: tickets.filter((t) => t.prioridad === "media").length, key: "media" },
    { name: "Baja", value: tickets.filter((t) => t.prioridad === "baja").length, key: "baja" },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-wide mb-1">
        Dashboard
      </h1>
      <p className="text-sm text-muted mb-6">
        {user?.rol === "admin_global"
          ? "Vista global de todos los departamentos"
          : `Vista de ${user?.departamento_nombre || "tu departamento"}`}
      </p>

      {alertas && <TarjetaPrevencion alertas={alertas} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={total} />
        <StatCard label="Abiertos" value={abiertos} accent="#d92d20" />
        <StatCard label="En proceso" value={enProceso} accent="#e08a1e" />
        <StatCard label="Cerrados" value={cerrados} accent="#1f9d63" />
      </div>

      {promedioCierre !== null && (
        <p className="-mt-6 mb-8 text-sm text-muted">
          Tiempo promedio de cierre:{" "}
          <span className="font-semibold text-ink">{promedioCierre} días</span>{" "}
          sobre {cerrados} incidencia(s) cerradas.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
          <p className="text-xs font-mono uppercase tracking-wide text-muted mb-4">
            Tickets por estado
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={porEstado}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {porEstado.map((d) => (
                  <Cell key={d.key} fill={ESTADO_COLORS[d.key]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e7e7ea",
                  borderRadius: 8,
                  color: "#1a1a1a",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
          <p className="text-xs font-mono uppercase tracking-wide text-muted mb-4">
            Tickets por prioridad
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={porPrioridad}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {porPrioridad.map((d) => (
                  <Cell key={d.key} fill={PRIORIDAD_COLORS[d.key]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e7e7ea",
                  borderRadius: 8,
                  color: "#1a1a1a",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {user?.rol === "admin_global" && (
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
          <p className="text-xs font-mono uppercase tracking-wide text-muted mb-4">
            Tickets por departamento
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porDepartamento}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e7ea" />
              <XAxis dataKey="departamento" stroke="#8a8a90" fontSize={12} />
              <YAxis stroke="#8a8a90" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e7e7ea",
                  borderRadius: 8,
                  color: "#1a1a1a",
                }}
              />
              <Bar dataKey="cantidad" fill="#ffc400" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-5 shadow-sm mt-6">
        <p className="text-xs font-mono uppercase tracking-wide text-muted mb-1">
          Tendencia de las últimas 8 semanas
        </p>
        <p className="text-xs text-muted mb-4">
          Si la línea de cerradas va por encima de la de registradas, el rezago baja.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={tendencia}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e7ea" />
            <XAxis dataKey="etiqueta" stroke="#8a8a90" fontSize={12} />
            <YAxis stroke="#8a8a90" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e7e7ea",
                borderRadius: 8,
                color: "#1a1a1a",
              }}
            />
            <Line
              type="monotone"
              dataKey="registradas"
              name="Registradas"
              stroke="#d92d20"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="cerradas"
              name="Cerradas"
              stroke="#1f9d63"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {user?.rol === "admin_global" && porEstacion.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm mt-6">
          <p className="text-xs font-mono uppercase tracking-wide text-muted mb-1">
            Comparativa por estación
          </p>
          <p className="text-xs text-muted mb-4">
            Cuántas incidencias genera cada estación y cuánto tarda en cerrarlas.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porEstacion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e7ea" />
              <XAxis dataKey="estacion" stroke="#8a8a90" fontSize={12} />
              <YAxis stroke="#8a8a90" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e7e7ea",
                  borderRadius: 8,
                  color: "#1a1a1a",
                }}
              />
              <Bar dataKey="abiertas" name="Abiertas" stackId="a" fill="#d92d20" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cerradas" name="Cerradas" stackId="a" fill="#1f9d63" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-2 font-mono text-xs uppercase tracking-wide text-muted">Estación</th>
                  <th className="py-2 font-mono text-xs uppercase tracking-wide text-muted">Total</th>
                  <th className="py-2 font-mono text-xs uppercase tracking-wide text-muted">Abiertas</th>
                  <th className="py-2 font-mono text-xs uppercase tracking-wide text-muted">Cierre promedio</th>
                </tr>
              </thead>
              <tbody>
                {porEstacion.map((e) => (
                  <tr key={e.estacion} className="border-b border-border last:border-0">
                    <td className="py-2 text-ink">{e.estacion}</td>
                    <td className="py-2 text-ink-soft">{e.total}</td>
                    <td className={`py-2 ${e.abiertas > 0 ? "text-danger font-medium" : "text-ink-soft"}`}>
                      {e.abiertas}
                    </td>
                    <td className="py-2 text-ink-soft">
                      {e.promedio ? `${e.promedio} días` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
