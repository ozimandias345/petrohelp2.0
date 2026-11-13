import { useEffect, useState } from "react";
import client from "../api/client";

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

export default function DepartmentList() {
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creando, setCreando] = useState(false);
  const [crearError, setCrearError] = useState("");

  const [confirmarBorrarId, setConfirmarBorrarId] = useState(null);
  const [borrandoId, setBorrandoId] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  function cargar() {
    setLoading(true);
    client
      .get("/departamentos/")
      .then((res) => setDepartamentos(res.data))
      .catch(() => setError("No se pudieron cargar los departamentos."))
      .finally(() => setLoading(false));
  }

  async function crearDepartamento(e) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    setCreando(true);
    setCrearError("");
    try {
      const res = await client.post("/departamentos/", { nombre: nombreNuevo.trim() });
      setDepartamentos((prev) =>
        [...prev, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setNombreNuevo("");
    } catch (err) {
      const detail =
        err.response?.data?.nombre?.[0] ||
        err.response?.data?.detail ||
        "No se pudo crear el departamento.";
      setCrearError(Array.isArray(detail) ? detail[0] : detail);
    } finally {
      setCreando(false);
    }
  }

  async function borrarDepartamento(depto) {
    setError("");
    setBorrandoId(depto.id);
    try {
      await client.delete(`/departamentos/${depto.id}/`);
      setDepartamentos((prev) => prev.filter((d) => d.id !== depto.id));
    } catch (err) {
      setError(
        err.response?.data?.detail || `No se pudo borrar «${depto.nombre}».`
      );
    } finally {
      setBorrandoId(null);
      setConfirmarBorrarId(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-ink tracking-wide mb-1">
        Departamentos
      </h1>
      <p className="text-sm text-muted mb-6">
        {loading ? "Cargando…" : `${departamentos.length} departamento(s) registrados`}
      </p>

      <form
        onSubmit={crearDepartamento}
        className="bg-surface border border-border rounded-lg p-5 mb-6 shadow-sm"
      >
        <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
          Nuevo departamento
        </label>
        <div className="flex gap-2">
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Ej. Mantenimiento"
            className="flex-1 bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-sm text-ink placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-ph-yellow"
          />
          <button
            disabled={creando || !nombreNuevo.trim()}
            className="bg-ph-yellow text-ph-black font-semibold text-sm px-4 rounded-md hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
          >
            {creando ? "Agregando…" : "Agregar"}
          </button>
        </div>
        {crearError && (
          <p className="text-danger text-sm mt-2">{crearError}</p>
        )}
      </form>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
        {!loading && departamentos.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-ink-soft font-medium">Aún no hay departamentos.</p>
            <p className="text-muted text-sm mt-1">Agrega el primero arriba.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {departamentos.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-ink">{d.nombre}</span>

                {confirmarBorrarId === d.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted">¿Seguro?</span>
                    <button
                      onClick={() => borrarDepartamento(d)}
                      disabled={borrandoId === d.id}
                      className="text-xs font-semibold text-ph-black bg-ph-yellow hover:bg-ph-yellow-dark px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                    >
                      {borrandoId === d.id ? "Borrando…" : "Sí, borrar"}
                    </button>
                    <button
                      onClick={() => setConfirmarBorrarId(null)}
                      disabled={borrandoId === d.id}
                      className="text-xs font-medium text-muted hover:text-ink px-2 py-1 rounded-md transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmarBorrarId(d.id)}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-ph-black font-mono uppercase tracking-wide transition-colors"
                  >
                    <TrashIcon />
                    Borrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
