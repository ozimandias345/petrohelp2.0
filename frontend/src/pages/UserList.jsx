import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { RolBadge } from "../components/Badges";
import { EditIcon } from "../components/Icons";

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

const EDIT_VACIO = { first_name: "", last_name: "", email: "", password: "" };

export default function UserList() {
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guardandoId, setGuardandoId] = useState(null);
  const [confirmarBorrarId, setConfirmarBorrarId] = useState(null);
  const [borrandoId, setBorrandoId] = useState(null);

  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(EDIT_VACIO);
  const [editError, setEditError] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    cargar();
    client.get("/departamentos/").then((res) => setDepartamentos(res.data));
  }, []);

  function cargar() {
    setLoading(true);
    client
      .get("/usuarios/")
      .then((res) => setUsuarios(res.data))
      .catch(() => setError("No se pudieron cargar los usuarios."))
      .finally(() => setLoading(false));
  }

  async function actualizarCampo(usuario, campo, valor) {
    setGuardandoId(usuario.id);
    try {
      const res = await client.patch(`/usuarios/${usuario.id}/`, { [campo]: valor });
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? res.data : u)));
    } catch {
      setError(`No se pudo actualizar a ${usuario.username}.`);
    } finally {
      setGuardandoId(null);
    }
  }

  function empezarEdicion(usuario) {
    setEditandoId(usuario.id);
    setEditForm({
      first_name: usuario.first_name || "",
      last_name: usuario.last_name || "",
      email: usuario.email || "",
      password: "",
    });
    setEditError("");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEditForm(EDIT_VACIO);
    setEditError("");
  }

  async function guardarEdicion(usuario) {
    setGuardandoEdicion(true);
    setEditError("");
    try {
      const payload = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      const res = await client.patch(`/usuarios/${usuario.id}/`, payload);
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? res.data : u)));
      cancelarEdicion();
    } catch (err) {
      const detail =
        err.response?.data?.email?.[0] ||
        err.response?.data?.password?.[0] ||
        err.response?.data?.detail ||
        "No se pudo guardar los cambios.";
      setEditError(Array.isArray(detail) ? detail[0] : detail);
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function borrarUsuario(usuario) {
    setError("");
    setBorrandoId(usuario.id);
    try {
      await client.delete(`/usuarios/${usuario.id}/`);
      setUsuarios((prev) => prev.filter((u) => u.id !== usuario.id));
    } catch (err) {
      // El backend rechaza el borrado si el usuario tiene tickets,
      // comentarios o historial asociados, y explica por qué.
      setError(
        err.response?.data?.detail || `No se pudo borrar a ${usuario.username}.`
      );
    } finally {
      setBorrandoId(null);
      setConfirmarBorrarId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">
            Usuarios
          </h1>
          <p className="text-sm text-muted mt-1">
            {loading ? "Cargando…" : `${usuarios.length} usuario(s) registrados`}
          </p>
        </div>
        <Link
          to="/usuarios/nuevo"
          className="bg-ph-yellow text-ph-black font-semibold text-sm px-4 py-2.5 rounded-md hover:bg-ph-yellow-dark transition-colors"
        >
          + Nuevo usuario
        </Link>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="bg-surface border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-surface-alt border-b border-border text-left">
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">
                Usuario
              </th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">
                Rol
              </th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">
                Departamento
              </th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">
                Activo
              </th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{u.username}</p>
                  {editandoId === u.id ? (
                    <div className="mt-2 space-y-1.5 min-w-[200px]">
                      <input
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        placeholder="Nombre"
                        className="w-full bg-surface-alt border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ph-yellow"
                      />
                      <input
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        placeholder="Apellido"
                        className="w-full bg-surface-alt border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ph-yellow"
                      />
                      <input
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="Correo"
                        type="email"
                        className="w-full bg-surface-alt border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ph-yellow"
                      />
                      <input
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        placeholder="Nueva contraseña (opcional)"
                        type="password"
                        autoComplete="new-password"
                        className="w-full bg-surface-alt border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ph-yellow"
                      />
                      {editError && <p className="text-danger text-xs">{editError}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">{u.email || "sin correo"}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.rol}
                    disabled={guardandoId === u.id}
                    onChange={(e) => actualizarCampo(u, "rol", e.target.value)}
                    className="bg-surface-alt border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ph-yellow"
                  >
                    <option value="operador">Operador</option>
                    <option value="admin_departamento">Admin. Departamento</option>
                    <option value="admin_global">Admin. Global</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.departamento || ""}
                    disabled={guardandoId === u.id}
                    onChange={(e) =>
                      actualizarCampo(
                        u,
                        "departamento",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="bg-surface-alt border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ph-yellow"
                  >
                    <option value="">— Sin asignar —</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => actualizarCampo(u, "activo", !u.activo)}
                    disabled={guardandoId === u.id}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium font-mono uppercase border transition-colors ${
                      u.activo
                        ? "bg-success-tint text-success border-success/30"
                        : "bg-surface-alt text-muted border-border"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  {editandoId === u.id ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => guardarEdicion(u)}
                        disabled={guardandoEdicion}
                        className="text-xs font-semibold text-ph-black bg-ph-yellow hover:bg-ph-yellow-dark px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                      >
                        {guardandoEdicion ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        onClick={cancelarEdicion}
                        disabled={guardandoEdicion}
                        className="text-xs font-medium text-muted hover:text-ink px-2 py-1 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : confirmarBorrarId === u.id ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs text-muted">¿Seguro?</span>
                      <button
                        onClick={() => borrarUsuario(u)}
                        disabled={borrandoId === u.id}
                        className="text-xs font-semibold text-ph-black bg-ph-yellow hover:bg-ph-yellow-dark px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                      >
                        {borrandoId === u.id ? "Borrando…" : "Sí, borrar"}
                      </button>
                      <button
                        onClick={() => setConfirmarBorrarId(null)}
                        disabled={borrandoId === u.id}
                        className="text-xs font-medium text-muted hover:text-ink px-2 py-1 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => empezarEdicion(u)}
                        className="flex items-center gap-1.5 text-xs text-muted hover:text-ink font-mono uppercase tracking-wide transition-colors"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        onClick={() => setConfirmarBorrarId(u.id)}
                        className="flex items-center gap-1.5 text-xs text-muted hover:text-ph-black font-mono uppercase tracking-wide transition-colors"
                      >
                        <TrashIcon />
                        Borrar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && usuarios.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-10 text-center mt-4">
          <p className="text-ink-soft font-medium">No hay usuarios registrados.</p>
        </div>
      )}
    </div>
  );
}
