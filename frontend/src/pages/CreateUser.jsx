import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

export default function CreateUser() {
  const [departamentos, setDepartamentos] = useState([]);
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    rol: "operador",
    departamento: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    client.get("/departamentos/").then((res) => setDepartamentos(res.data));
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/usuarios/", {
        ...form,
        departamento: form.departamento ? Number(form.departamento) : null,
      });
      navigate("/usuarios");
    } catch (err) {
      const data = err.response?.data || {};
      const primerError = Object.values(data)[0];
      setError(
        Array.isArray(primerError)
          ? primerError[0]
          : primerError || "No se pudo crear el usuario. Revisa los campos."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold text-ink tracking-wide mb-1">
        Nuevo usuario
      </h1>
      <p className="text-sm text-muted mb-6">
        Se le podrá asignar un rol y departamento en cualquier momento desde la lista.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg p-6 space-y-5 shadow-sm"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Usuario
            </label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
              placeholder="operador2"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Correo
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
              placeholder="correo@petrohelp.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Nombre
            </label>
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Apellido
            </label>
            <input
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Contraseña
          </label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={8}
            className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Rol
            </label>
            <select
              name="rol"
              value={form.rol}
              onChange={handleChange}
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            >
              <option value="operador">Operador</option>
              <option value="admin_departamento">Admin. Departamento</option>
              <option value="admin_global">Admin. Global</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-muted mb-2">
              Departamento
            </label>
            <select
              name="departamento"
              value={form.departamento}
              onChange={handleChange}
              className="w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-ph-yellow"
            >
              <option value="">— Sin asignar —</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ph-yellow text-ph-black font-semibold rounded-md py-2.5 hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
        >
          {loading ? "Creando…" : "Crear usuario"}
        </button>
      </form>
    </div>
  );
}
