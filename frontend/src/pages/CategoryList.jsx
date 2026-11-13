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

export default function CategoryList() {
  const [categorias, setCategorias] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [departamentoNuevo, setDepartamentoNuevo] = useState("");
  const [creando, setCreando] = useState(false);
  const [crearError, setCrearError] = useState("");

  const [confirmarBorrarId, setConfirmarBorrarId] = useState(null);
  const [borrandoId, setBorrandoId] = useState(null);

  useEffect(() => {
    cargar();
    client.get("/departamentos/").then((res) => setDepartamentos(res.data));
  }, []);

  function cargar() {
    setLoading(true);
    client
      .get("/categorias/")
      .then((res) => setCategorias(res.data))
      .catch(() => setError("No se pudieron cargar las categorías."))
      .finally(() => setLoading(false));
  }

  async function crearCategoria(e) {
    e.preventDefault();
    if (!nombreNuevo.trim() || !departamentoNuevo) return;
    setCreando(true);
    setCrearError("");
    try {
      const res = await client.post("/categorias/", {
        nombre: nombreNuevo.trim(),
        departamento: Number(departamentoNuevo),
      });
      setCategorias((prev) =>
        [...prev, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setNombreNuevo("");
      setDepartamentoNuevo("");
    } catch (err) {
      const detail =
        err.response?.data?.nombre?.[0] ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        "No se pudo crear la categoría.";
      setCrearError(Array.isArray(detail) ? detail[0] : detail);
    } finally {
      setCreando(false);
    }
  }

  async function borrarCategoria(cat) {
    setError("");
    setBorrandoId(cat.id);
    try {
      await client.delete(`/categorias/${cat.id}/`);
      setCategorias((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      setError(
        err.response?.data?.detail || `No se pudo borrar «${cat.nombre}».`
      );
    } finally {
      setBorrandoId(null);
      setConfirmarBorrarId(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-ink tracking-wide mb-1">
        Categorías
      </h1>
      <p className="text-sm text-muted mb-6">
        {loading ? "Cargando…" : `${categorias.length} categoría(s) registradas`}
      </p>

      <form
        onSubmit={crearCategoria}
        className="bg-surface border border-border rounded-lg p-5 mb-6 shadow-sm space-y-3"
      >
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Nueva categoría
          </label>
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Ej. Falla eléctrica"
            className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-sm text-ink placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-ph-yellow"
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Departamento
          </label>
          <div className="flex gap-2">
            <select
              value={departamentoNuevo}
              onChange={(e) => setDepartamentoNuevo(e.target.value)}
              className="flex-1 bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            >
              <option value="">Selecciona…</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <button
              disabled={creando || !nombreNuevo.trim() || !departamentoNuevo}
              className="bg-ph-yellow text-ph-black font-semibold text-sm px-4 rounded-md hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
            >
              {creando ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </div>
        {crearError && (
          <p className="text-danger text-sm">{crearError}</p>
        )}
      </form>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
        {!loading && categorias.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-ink-soft font-medium">Aún no hay categorías.</p>
            <p className="text-muted text-sm mt-1">Agrega la primera arriba.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {categorias.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-ink">{c.nombre}</span>
                  <span className="text-xs text-muted ml-2">
                    {c.departamento_nombre}
                  </span>
                </div>

                {confirmarBorrarId === c.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted">¿Seguro?</span>
                    <button
                      onClick={() => borrarCategoria(c)}
                      disabled={borrandoId === c.id}
                      className="text-xs font-semibold text-ph-black bg-ph-yellow hover:bg-ph-yellow-dark px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                    >
                      {borrandoId === c.id ? "Borrando…" : "Sí, borrar"}
                    </button>
                    <button
                      onClick={() => setConfirmarBorrarId(null)}
                      disabled={borrandoId === c.id}
                      className="text-xs font-medium text-muted hover:text-ink px-2 py-1 rounded-md transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmarBorrarId(c.id)}
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
