import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import client from "../api/client";
import agentClient from "../api/agentClient";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";

// Mapa de todas las estaciones que usan PetroHelp.
// Color del marcador = estado de la estación:
//   rojo     → incidencias de prioridad alta abiertas o sensor en riesgo
//   amarillo → incidencias abiertas, sensor en atención o sin comunicación
//   verde    → todo en orden
//   gris     → estación inactiva

const CENTRO_INICIAL = [32.5149, -117.0382]; // Tijuana
const COLORES = { riesgo: "#d92d20", atencion: "#ffc400", ok: "#1f9d63", inactiva: "#8a8a90" };
const ETIQUETA = { riesgo: "En riesgo", atencion: "Requiere atención", ok: "Todo en orden", inactiva: "Inactiva" };

function nivelSensor(valor, u) {
  if (valor == null || !u) return 0;
  const mayor = u.direccion !== "menor";
  const supera = (lim) => (mayor ? valor >= lim : valor <= lim);
  return supera(u.alta) ? 2 : supera(u.media) ? 1 : 0;
}

function iconoEstacion(estado, seleccionada) {
  const c = COLORES[estado];
  const tam = seleccionada ? 44 : 34;
  return L.divIcon({
    className: "",
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
    popupAnchor: [0, -tam / 2],
    html: `<div style="width:${tam}px;height:${tam}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">
      <svg viewBox="0 0 120 120" width="${tam}" height="${tam}">
        <path d="M60 6 114 60 60 114 6 60Z" fill="${c}" stroke="#111" stroke-width="8" stroke-linejoin="round"/>
        <rect x="47" y="42" width="20" height="32" rx="3" fill="#111"/>
        <rect x="50.5" y="46" width="13" height="8" rx="1.5" fill="${c}"/>
        <rect x="44" y="73" width="26" height="5" rx="1.5" fill="#111"/>
        <path d="M67 51h4a3 3 0 0 1 3 3v12a3.5 3.5 0 0 0 7 0V53l-3-4" fill="none" stroke="#111" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg></div>`,
  });
}

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

export default function Mapa() {
  const { user } = useAuth();
  const esGlobal = user?.rol === "admin_global";
  const esAdmin = esGlobal || user?.rol === "admin_departamento";

  const [estaciones, setEstaciones] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccion, setSeleccion] = useState(null);
  const [ubicando, setUbicando] = useState(null); // estación que se está colocando
  const [guardando, setGuardando] = useState(false);

  const divMapa = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const ubicandoRef = useRef(null);
  const encuadrado = useRef(false);
  ubicandoRef.current = ubicando;

  // ---------- Datos ----------
  function cargar() {
    return Promise.all([
      client.get("/estaciones/"),
      client.get("/tickets/"),
      esAdmin ? agentClient.get("/dispositivos").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ])
      .then(([e, t, d]) => {
        setEstaciones(e.data);
        setTickets(t.data);
        setDispositivos(d.data);
      })
      .catch(() => setError("No se pudieron cargar las estaciones."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estado calculado por estación
  const info = useMemo(() => {
    return estaciones.map((e) => {
      const propios = tickets.filter((t) => t.estacion === e.id && t.estado !== "cerrado");
      const altas = propios.filter((t) => t.prioridad === "alta").length;
      const sensores = dispositivos.filter((d) => d.estacion_id === e.id);
      let peorSensor = 0;
      let sinConexion = 0;
      sensores.forEach((d) => {
        if (!d.en_linea) {
          sinConexion += 1;
          return;
        }
        ["gas_ppm", "temperatura", "nivel_tanque"].forEach((k) => {
          peorSensor = Math.max(peorSensor, nivelSensor(d.ultima_lectura?.[k], d.umbrales?.[k]));
        });
      });
      let estado = "ok";
      if (!e.activa) estado = "inactiva";
      else if (altas > 0 || peorSensor === 2) estado = "riesgo";
      else if (propios.length > 0 || peorSensor === 1 || sinConexion > 0) estado = "atencion";
      const lat = e.latitud != null ? Number(e.latitud) : null;
      const lng = e.longitud != null ? Number(e.longitud) : null;
      return { ...e, lat, lng, abiertos: propios.length, altas, sensores: sensores.length, sinConexion, estado };
    });
  }, [estaciones, tickets, dispositivos]);

  const ubicadas = info.filter((e) => e.lat != null && e.lng != null);
  const sinUbicar = info.filter((e) => e.lat == null || e.lng == null);

  // ---------- Mapa ----------
  useEffect(() => {
    if (loading || mapa.current || !divMapa.current) return;
    encuadrado.current = false;
    mapa.current = L.map(divMapa.current, { zoomControl: true }).setView(CENTRO_INICIAL, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);

    // Clic en el mapa: colocar la estación que se está ubicando
    mapa.current.on("click", (ev) => {
      const est = ubicandoRef.current;
      if (!est) return;
      guardarUbicacion(est, ev.latlng.lat, ev.latlng.lng);
    });
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Pintar marcadores
  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    capa.current.clearLayers();
    ubicadas.forEach((e) => {
      const m = L.marker([e.lat, e.lng], {
        icon: iconoEstacion(e.estado, seleccion === e.id),
        draggable: esGlobal && ubicando?.id === e.id,
        zIndexOffset: seleccion === e.id ? 1000 : 0,
      });
      m.bindPopup(
        `<div style="font-family:Inter,sans-serif;min-width:190px">
          <div style="font-weight:700;font-size:14px;margin-bottom:2px">${esc(e.nombre)}</div>
          ${e.direccion ? `<div style="color:#8a8a90;font-size:12px;margin-bottom:6px">${esc(e.direccion)}</div>` : ""}
          <div style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${COLORES[e.estado]};color:${e.estado === "atencion" ? "#111" : "#fff"}">${ETIQUETA[e.estado]}</div>
          <div style="font-size:12px;margin-top:8px;line-height:1.6">
            Incidencias abiertas: <b>${e.abiertos}</b><br/>
            Prioridad alta: <b style="color:${e.altas ? "#d92d20" : "inherit"}">${e.altas}</b>
            ${esAdmin ? `<br/>Sensores: <b>${e.sensores}</b>${e.sinConexion ? ` <span style="color:#e08a1e">(${e.sinConexion} sin conexión)</span>` : ""}` : ""}
          </div></div>`
      );
      m.on("click", () => setSeleccion(e.id));
      m.on("dragend", (ev) => {
        const p = ev.target.getLatLng();
        guardarUbicacion(e, p.lat, p.lng);
      });
      m.addTo(capa.current);
    });
    // Encuadrar todas las estaciones la primera vez
    if (!encuadrado.current && ubicadas.length) {
      mapa.current.fitBounds(L.latLngBounds(ubicadas.map((e) => [e.lat, e.lng])), { padding: [50, 50], maxZoom: 14 });
      encuadrado.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, seleccion, ubicando]);

  // Cursor de "colocar"
  useEffect(() => {
    if (divMapa.current) divMapa.current.style.cursor = ubicando ? "crosshair" : "";
  }, [ubicando]);

  function irA(e) {
    setSeleccion(e.id);
    if (e.lat != null && mapa.current) mapa.current.flyTo([e.lat, e.lng], 15, { duration: 0.8 });
  }

  async function guardarUbicacion(e, lat, lng) {
    setGuardando(true);
    try {
      await client.patch(`/estaciones/${e.id}/`, { latitud: lat.toFixed(6), longitud: lng.toFixed(6) });
      setEstaciones((prev) => prev.map((x) => (x.id === e.id ? { ...x, latitud: lat, longitud: lng } : x)));
      setUbicando(null);
      setSeleccion(e.id);
    } catch {
      setError("No se pudo guardar la ubicación.");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <Spinner full />;

  const conteo = (est) => info.filter((e) => e.estado === est).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">Mapa de estaciones</h1>
          <p className="text-sm text-muted mt-1">Todas las sucursales que usan PetroHelp y su estado actual.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["riesgo", "atencion", "ok"].map((k) => (
            <span key={k} className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-3 py-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORES[k] }} />
              {ETIQUETA[k]} <b className="font-semibold">{conteo(k)}</b>
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      {ubicando && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 bg-ph-yellow text-ph-black rounded-lg px-4 py-3">
          <p className="text-sm font-medium">
            {guardando ? "Guardando…" : <>Haz clic en el mapa donde está <b>{ubicando.nombre}</b>{ubicando.lat != null && " (o arrastra su marcador)"}.</>}
          </p>
          <button onClick={() => setUbicando(null)} className="text-sm font-semibold underline">Cancelar</button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="relative z-0 bg-surface border border-border rounded-lg overflow-hidden">
          <div ref={divMapa} className="h-[60vh] lg:h-[70vh] w-full" />
          {ubicadas.length === 0 && !ubicando && (
            <div className="absolute inset-x-4 top-4 z-[500] bg-surface/95 border border-border rounded-lg px-4 py-3 text-sm text-ink-soft shadow">
              Aún no hay estaciones ubicadas.{" "}
              {esGlobal ? "Usa “Ubicar” en la lista para colocarlas en el mapa." : "Pide al administrador global que las ubique."}
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg flex flex-col max-h-[70vh]">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-mono uppercase tracking-wide text-muted">{info.length} estaciones</p>
          </div>
          <div className="overflow-y-auto divide-y divide-border">
            {info.map((e) => (
              <div
                key={e.id}
                onClick={() => irA(e)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  seleccion === e.id ? "bg-ph-yellow-tint" : "hover:bg-surface-alt"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORES[e.estado] }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{e.nombre}</p>
                    <p className="text-xs text-muted truncate">{e.direccion || "Sin dirección"}</p>
                    <p className="text-xs text-ink-soft mt-1">
                      {e.abiertos} abierta(s)
                      {e.altas > 0 && <span className="text-danger font-medium"> · {e.altas} alta(s)</span>}
                      {e.lat == null && <span className="text-warn font-medium"> · sin ubicación</span>}
                    </p>
                  </div>
                  {esGlobal && (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setUbicando(e);
                        if (e.lat != null) irA(e);
                      }}
                      className="shrink-0 text-xs font-semibold text-ph-black border border-border hover:border-ph-yellow hover:bg-ph-yellow-tint rounded-md px-2.5 py-1"
                    >
                      {e.lat == null ? "Ubicar" : "Mover"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {sinUbicar.length > 0 && esGlobal && (
            <p className="px-4 py-3 border-t border-border text-xs text-muted">
              {sinUbicar.length} estación(es) sin ubicar. Pulsa “Ubicar” y luego haz clic en el mapa.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
