import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import agentClient from "../api/agentClient";
import Spinner from "../components/Spinner";

// Monitoreo de los ESP32 instalados en las estaciones.
// Se refresca cada 10 s consultando al agente FastAPI.

const SENSORES = [
  { clave: "temperatura", etiqueta: "Temperatura", unidad: "°C" },
  { clave: "gas_ppm", etiqueta: "Gas", unidad: "ppm" },
  { clave: "nivel_tanque", etiqueta: "Nivel tanque", unidad: "%" },
];

function estadoSensor(valor, umbral) {
  if (valor == null || !umbral) return "normal";
  const mayor = umbral.direccion !== "menor";
  const supera = (lim) => (mayor ? valor >= lim : valor <= lim);
  if (supera(umbral.alta)) return "alta";
  if (supera(umbral.media)) return "media";
  return "normal";
}

const COLOR = {
  normal: "text-ink",
  media: "text-warn",
  alta: "text-danger",
};

// Estado general: solo cuentan los dispositivos en línea (los valores
// de un sensor desconectado son viejos y no reflejan el estado actual).
function estadoGeneral(dispositivos) {
  if (dispositivos.length === 0) return null;
  const enLinea = dispositivos.filter((d) => d.en_linea);
  const niveles = enLinea.flatMap((d) =>
    SENSORES.map((s) => estadoSensor(d.ultima_lectura?.[s.clave], d.umbrales?.[s.clave]))
  );
  const fuera = dispositivos.length - enLinea.length;

  if (niveles.includes("alta"))
    return {
      tono: "bg-danger text-white",
      titulo: "Riesgo detectado",
      texto: "Uno o más sensores superan el límite de seguridad. Ya se generó la alerta.",
    };
  if (niveles.includes("media"))
    return {
      tono: "bg-ph-yellow text-ph-black",
      titulo: "Atención preventiva",
      texto: "Hay lecturas acercándose al límite. Revisa antes de que se vuelva un problema.",
    };
  if (fuera > 0)
    return {
      tono: "bg-ph-yellow text-ph-black",
      titulo: `${fuera} sensor(es) sin comunicación`,
      texto: "No podemos vigilar esa zona hasta que vuelva a conectarse.",
    };
  return {
    tono: "bg-success text-white",
    titulo: "Todo en orden",
    texto: "Todos los sensores en línea y dentro de rangos seguros.",
  };
}

function hace(tsIso) {
  if (!tsIso) return "sin datos";
  const seg = Math.round((Date.now() - new Date(tsIso)) / 1000);
  if (seg < 60) return `hace ${seg}s`;
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  return `hace ${Math.round(seg / 3600)} h`;
}

function TarjetaDispositivo({ d }) {
  const l = d.ultima_lectura;
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-ink truncate">{d.nombre || d.device_id}</h3>
          <p className="text-xs text-muted font-mono truncate">{d.device_id}</p>
          {d.ubicacion && <p className="text-xs text-muted mt-0.5">{d.ubicacion}</p>}
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
            d.en_linea ? "bg-success-tint text-success" : "bg-surface-alt text-muted"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${d.en_linea ? "bg-success" : "bg-muted"}`} />
          {d.en_linea ? "En línea" : "Fuera de línea"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {SENSORES.map((s) => {
          const valor = l?.[s.clave];
          const est = estadoSensor(valor, d.umbrales?.[s.clave]);
          return (
            <div key={s.clave} className="bg-surface-alt rounded-md px-2.5 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted font-mono">{s.etiqueta}</p>
              <p className={`font-display text-xl font-semibold ${COLOR[est]}`}>
                {valor ?? "—"}
                <span className="text-xs font-body font-normal text-muted ml-0.5">{valor != null && s.unidad}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted">
        <span>Última lectura: {hace(l?.ts)}</span>
        <span className={d.alertas_24h ? "text-danger font-medium" : ""}>
          {d.alertas_24h} alerta(s) en 24 h
        </span>
      </div>
    </div>
  );
}

export default function Dispositivos() {
  const [dispositivos, setDispositivos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function cargar() {
    Promise.all([agentClient.get("/dispositivos"), agentClient.get("/alertas?limite=20")])
      .then(([d, a]) => {
        setDispositivos(d.data);
        setAlertas(a.data);
        setError("");
      })
      .catch(() =>
        setError("No se pudo conectar con el agente ESP32 (¿está corriendo en el puerto 8001?).")
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 10000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <Spinner full />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">
          Dispositivos IoT
        </h1>
        <p className="text-sm text-muted mt-1">
          Sensores ESP32 en estaciones · se actualiza cada 10 s
        </p>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {!error && (() => {
        const eg = estadoGeneral(dispositivos);
        return eg ? (
          <div className={`rounded-lg px-5 py-4 mb-5 ${eg.tono}`}>
            <p className="font-display text-xl font-semibold tracking-wide">{eg.titulo}</p>
            <p className="text-sm opacity-90 mt-0.5">{eg.texto}</p>
          </div>
        ) : null;
      })()}

      {!error && dispositivos.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-10 text-center">
          <p className="text-ink-soft font-medium">No hay dispositivos registrados.</p>
          <p className="text-muted text-sm mt-1">Agrégalos en dispositivos.json del agente.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {dispositivos.map((d) => (
          <TarjetaDispositivo key={d.device_id} d={d} />
        ))}
      </div>

      <h2 className="font-display text-xl font-semibold text-ink tracking-wide mt-8 mb-3">
        Alertas recientes
      </h2>
      {alertas.length === 0 ? (
        <p className="text-sm text-muted">Sin alertas.</p>
      ) : (
        <div className="space-y-2">
          {alertas.map((a) => (
            <div
              key={a.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-surface border border-border rounded-lg px-4 py-3"
            >
              <span
                className={`shrink-0 text-xs font-semibold uppercase px-2 py-0.5 rounded w-fit ${
                  a.severidad === "alta" ? "bg-danger-tint text-danger" : "bg-warn-tint text-warn"
                }`}
              >
                {a.severidad}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink">{a.mensaje}</p>
                <p className="text-xs text-muted mt-0.5">
                  <span className="font-mono">{a.device_id}</span> · {hace(a.ts)} ·{" "}
                  {a.origen === "ia" ? "Analizado por IA" : "Reglas"}
                  {a.decision && <> · {a.decision}</>}
                </p>
              </div>
              {a.ticket_id ? (
                <Link
                  to={`/tickets/${a.ticket_id}`}
                  className="shrink-0 text-sm font-semibold text-ph-black underline decoration-ph-yellow decoration-2 underline-offset-2"
                >
                  Ticket #{a.ticket_id}
                </Link>
              ) : (
                <span className="shrink-0 text-xs text-muted">Sin ticket</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
