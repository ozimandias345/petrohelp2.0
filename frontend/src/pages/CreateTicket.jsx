import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

// Baja = verde, Media = amarillo, Alta = rojo: mismo código de color
// que ya se usa en los badges de prioridad del resto de la app.
const PRIORIDAD_ESTILO = {
  baja: { activo: "bg-success-tint border-success text-success", hover: "hover:border-success/40" },
  media: { activo: "bg-warn-tint border-warn text-warn", hover: "hover:border-warn/40" },
  alta: { activo: "bg-danger-tint border-danger text-danger", hover: "hover:border-danger/40" },
};

const MAX_FOTO_MB = 8;

export default function CreateTicket() {
  const [categorias, setCategorias] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    categoria: "",
    estacion: "",
    prioridad: "media",
  });
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    client.get("/categorias/").then((res) => setCategorias(res.data));
    client.get("/estaciones/").then((res) => setEstaciones(res.data));
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleFoto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) {
      setFoto(null);
      setFotoPreview(null);
      return;
    }
    if (archivo.size > MAX_FOTO_MB * 1024 * 1024) {
      setError(`La foto no puede pesar más de ${MAX_FOTO_MB} MB.`);
      e.target.value = "";
      return;
    }
    setError("");
    setFoto(archivo);
    setFotoPreview(URL.createObjectURL(archivo));
  }

  function quitarFoto() {
    setFoto(null);
    setFotoPreview(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = new FormData();
      data.append("titulo", form.titulo);
      data.append("descripcion", form.descripcion);
      data.append("categoria", Number(form.categoria));
      data.append("estacion", Number(form.estacion));
      data.append("prioridad", form.prioridad);
      if (foto) data.append("evidencia", foto);

      // No se fija el Content-Type a mano: el navegador arma
      // automáticamente el "multipart/form-data" con el boundary
      // correcto cuando el body es un FormData.
      const res = await client.post("/tickets/", data);
      navigate(`/tickets/${res.data.id}`);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {})[0] ||
        "No se pudo crear el ticket. Revisa los campos.";
      setError(Array.isArray(detail) ? detail[0] : detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-ink tracking-wide mb-1">
        Nuevo ticket
      </h1>
      <p className="text-sm text-muted mb-6">
        Se enrutará automáticamente al departamento correcto según la categoría.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg p-6 space-y-5 shadow-sm"
      >
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Título
          </label>
          <input
            name="titulo"
            value={form.titulo}
            onChange={handleChange}
            required
            className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            placeholder="Ej. No enciende la caja registradora"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Descripción
          </label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            required
            rows={4}
            className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            placeholder="Describe el problema con el mayor detalle posible…"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Categoría
            </label>
            <select
              name="categoria"
              value={form.categoria}
              onChange={handleChange}
              required
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            >
              <option value="">Selecciona…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.departamento_nombre})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Estación
            </label>
            <select
              name="estacion"
              value={form.estacion}
              onChange={handleChange}
              required
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            >
              <option value="">Selecciona…</option>
              {estaciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Foto de evidencia (opcional)
          </label>
          {fotoPreview ? (
            <div className="flex items-center gap-3">
              <img
                src={fotoPreview}
                alt="Vista previa"
                className="w-20 h-20 object-cover rounded-md border border-border"
              />
              <button
                type="button"
                onClick={quitarFoto}
                className="text-xs font-medium text-muted hover:text-ph-black transition-colors"
              >
                Quitar foto
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleFoto}
              className="w-full text-sm text-ink-soft file:mr-3 file:py-2 file:px-3.5 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-surface-alt file:text-ink-soft hover:file:bg-border/40 file:cursor-pointer cursor-pointer bg-surface-alt border border-border rounded-md px-3.5 py-2"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Prioridad
          </label>
          <div className="flex gap-2">
            {["baja", "media", "alta"].map((p) => {
              const estilo = PRIORIDAD_ESTILO[p];
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => setForm({ ...form, prioridad: p })}
                  className={`flex-1 py-2 rounded-md text-sm font-medium capitalize border transition-colors ${
                    form.prioridad === p
                      ? estilo.activo
                      : `border-border text-muted ${estilo.hover}`
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ph-yellow text-ph-black font-semibold rounded-md py-2.5 hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
        >
          {loading ? "Creando…" : "Crear ticket"}
        </button>
      </form>
    </div>
  );
}
