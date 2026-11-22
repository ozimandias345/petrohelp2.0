import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Spinner from "../components/Spinner";

// Catálogo de estaciones. La ubicación en el mapa se pone desde la
// pantalla de Mapa, dando clic sobre el punto; aquí se edita el resto.

const campo =
  "w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm text-ink placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-ph-yellow";

export default function StationList() {
  const [estaciones, setEstaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nueva, setNueva] = useState({ nombre: "", direccion: "" });
  const [creando, setCreando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [edicion, setEdicion] = useState({ nombre: "", direccion: "" });
  const [guardandoId, setGuardandoId] = useState(null);
  const [confirmarId, setConfirmarId] = useState(null);

  useEffect(() => {
    client
      .get("/estaciones/")
      .then((res) => setEstaciones(res.data))
      .catch(() => setError("No se pudieron cargar las estaciones."))
      .finally(() => setLoading(false));
  }, []);

  async function crear(e) {
    e.preventDefault();
    if (!nueva.nombre.trim()) return;
    setCreando(true);
    setError("");
    try {
      const res = await client.post("/estaciones/", {
        nombre: nueva.nombre.trim(),
        direccion: nueva.direccion.trim() || null,
        activa: true,
      });
      setEstaciones((prev) => [...prev, res.data]);
      setNueva({ nombre: "", direccion: "" });
    } catch (err) {
      setError(err.response?.data?.nombre?.[0] || "No se pudo crear la estación.");
    } finally {
      setCreando(false);
    }
  }

  async function guardar(est) {
    setGuardandoId(est.id);
    setError("");
    try {
      const res = await client.patch(`/estaciones/${est.id}/`, {
        nombre: edicion.nombre.trim(),
        direccion: edicion.direccion.trim() || null,
      });
      setEstaciones((prev) => prev.map((e) => (e.id === est.id ? res.data : e)));
      setEditandoId(null);
    } catch {
      setError("No se pudieron guardar los cambios.");
    } finally {
      setGuardandoId(null);
    }
  }

  async function alternarActiva(est) {
    setGuardandoId(est.id);
    try {
      const res = await client.patch(`/estaciones/${est.id}/`, { activa: !est.activa });
      setEstaciones((prev) => prev.map((e) => (e.id === est.id ? res.data : e)));
    } catch {
      setError("No se pudo cambiar el estado de la estación.");
    } finally {
      setGuardandoId(null);
    }
  }

  async function borrar(est) {
    setGuardandoId(est.id);
    setError("");
    try {
      await client.delete(`/estaciones/${est.id}/`);
      setEstaciones((prev) => prev.filter((e) => e.id !== est.id));
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          `No se puede borrar «${est.nombre}»: tiene incidencias registradas. Desactívala en su lugar.`
      );
    } finally {
      setGuardandoId(null);
      setConfirmarId(null);
    }
  }

  if (loading) return <Spinner full />;

  const sinUbicar = estaciones.filter((e) => e.latitud == null).length;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">
        Estaciones
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        {estaciones.length} estación(es) registradas
        {sinUbicar > 0 && (
          <>
            {" · "}
            <Link to="/mapa" className="underline decoration-ph-yellow decoration-2 underline-offset-2">
              {sinUbicar} sin ubicar en el mapa
            </Link>
          </>
        )}
      </p>

      <form onSubmit={crear} className="bg-surface border border-border rounded-lg p-5 mb-6">
        <p className="text-xs font-mono uppercase tracking-wide text-muted mb-3">Nueva estación</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
            placeholder="Ej. Estación 4 - Otay"
            className={campo}
          />
          <input
            value={nueva.direccion}
            onChange={(e) => setNueva({ ...nueva, direccion: e.target.value })}
            placeholder="Dirección (opcional)"
            className={campo}
          />
        </div>
        <button
          disabled={creando || !nueva.nombre.trim()}
          className="mt-3 bg-ph-yellow text-ph-black font-semibold text-sm px-4 py-2 rounded-md hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
        >
          {creando ? "Agregando…" : "Agregar"}
        </button>
        <p className="text-xs text-muted mt-2">
          Después colócala en el mapa para que aparezca con su marcador.
        </p>
      </form>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <ul className="divide-y divide-border">
          {estaciones.map((e) => (
            <li key={e.id} className="px-4 py-3">
              {editandoId === e.id ? (
                <div className="space-y-2">
                  <input
                    value={edicion.nombre}
                    onChange={(ev) => setEdicion({ ...edicion, nombre: ev.target.value })}
                    className={campo}
                  />
                  <input
                    value={edicion.direccion}
                    onChange={(ev) => setEdicion({ ...edicion, direccion: ev.target.value })}
                    placeholder="Dirección"
                    className={campo}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardar(e)}
                      disabled={guardandoId === e.id}
                      className="bg-ph-yellow text-ph-black font-semibold text-xs px-3 py-1.5 rounded-md hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
                    >
                      {guardandoId === e.id ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      onClick={() => setEditandoId(null)}
                      className="text-xs text-muted hover:text-ink px-2"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className={`text-sm font-medium ${e.activa ? "text-ink" : "text-muted line-through"}`}>
                      {e.nombre}
                    </p>
                    <p className="text-xs text-muted">
                      {e.direccion || "Sin dirección"}
                      {e.latitud == null && (
                        <span className="text-warn font-medium"> · sin ubicación</span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => alternarActiva(e)}
                    disabled={guardandoId === e.id}
                    className={`text-xs font-medium font-mono uppercase px-2.5 py-1 rounded-md border transition-colors ${
                      e.activa
                        ? "bg-success-tint text-success border-success/30"
                        : "bg-surface-alt text-muted border-border"
                    }`}
                  >
                    {e.activa ? "Activa" : "Inactiva"}
                  </button>

                  <button
                    onClick={() => {
                      setEditandoId(e.id);
                      setEdicion({ nombre: e.nombre, direccion: e.direccion || "" });
                    }}
                    className="text-xs font-mono uppercase tracking-wide text-muted hover:text-ink transition-colors"
                  >
                    Editar
                  </button>

                  {confirmarId === e.id ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-muted">¿Seguro?</span>
                      <button
                        onClick={() => borrar(e)}
                        disabled={guardandoId === e.id}
                        className="text-xs font-semibold text-ph-black bg-ph-yellow px-2.5 py-1 rounded-md hover:bg-ph-yellow-dark"
                      >
                        Sí, borrar
                      </button>
                      <button
                        onClick={() => setConfirmarId(null)}
                        className="text-xs text-muted hover:text-ink px-1"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmarId(e.id)}
                      className="text-xs font-mono uppercase tracking-wide text-muted hover:text-danger transition-colors"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {estaciones.length === 0 && (
          <p className="p-10 text-center text-sm text-ink-soft">Aún no hay estaciones.</p>
        )}
      </div>
    </div>
  );
}
