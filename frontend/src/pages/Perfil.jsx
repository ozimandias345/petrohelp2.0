import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

// Perfil propio: datos de la cuenta y cambio de contraseña.
// Lo usan los tres roles.

const ROLES = {
  operador: "Operador",
  admin_departamento: "Administrador de departamento",
  admin_global: "Administrador global",
};

const campo =
  "w-full bg-surface-alt border border-border rounded-md px-3.5 py-2.5 text-sm text-ink placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-ph-yellow";

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-mono uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className="text-sm text-ink text-right">{valor || "—"}</span>
    </div>
  );
}

export default function Perfil() {
  const { user, refrescarUsuario, guardarToken } = useAuth();

  const [datos, setDatos] = useState({ first_name: "", last_name: "", email: "" });
  const [guardando, setGuardando] = useState(false);
  const [avisoDatos, setAvisoDatos] = useState("");
  const [errorDatos, setErrorDatos] = useState("");

  const [pass, setPass] = useState({ actual: "", nueva: "", nueva2: "" });
  const [cambiando, setCambiando] = useState(false);
  const [avisoPass, setAvisoPass] = useState("");
  const [errorPass, setErrorPass] = useState("");

  useEffect(() => {
    if (user) {
      setDatos({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
      });
    }
  }, [user]);

  function mensaje(data, porDefecto) {
    if (!data) return porDefecto;
    if (typeof data === "string") return data;
    const partes = [];
    Object.values(data).forEach((v) => {
      if (Array.isArray(v)) partes.push(...v);
      else if (typeof v === "string") partes.push(v);
    });
    return partes.join(" ") || porDefecto;
  }

  async function guardarDatos(e) {
    e.preventDefault();
    setGuardando(true);
    setAvisoDatos("");
    setErrorDatos("");
    try {
      await client.patch("/auth/me/", datos);
      await refrescarUsuario();
      setAvisoDatos("Datos guardados.");
    } catch (err) {
      setErrorDatos(mensaje(err.response?.data, "No se pudieron guardar los datos."));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarPassword(e) {
    e.preventDefault();
    setAvisoPass("");
    setErrorPass("");
    if (pass.nueva !== pass.nueva2) {
      setErrorPass("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setCambiando(true);
    try {
      const res = await client.post("/auth/cambiar-password/", pass);
      guardarToken(res.data?.token);
      setPass({ actual: "", nueva: "", nueva2: "" });
      setAvisoPass(
        "Contraseña actualizada. Las sesiones abiertas en otros dispositivos se cerraron."
      );
    } catch (err) {
      setErrorPass(mensaje(err.response?.data, "No se pudo cambiar la contraseña."));
    } finally {
      setCambiando(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-wide">
        Mi perfil
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        Tus datos de cuenta y tu contraseña.
      </p>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <form onSubmit={guardarDatos} className="bg-surface border border-border rounded-lg p-5">
            <p className="text-xs font-mono uppercase tracking-wide text-muted mb-4">
              Datos personales
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm text-ink-soft">
                Nombre
                <input
                  value={datos.first_name}
                  onChange={(e) => setDatos({ ...datos, first_name: e.target.value })}
                  className={`${campo} mt-1`}
                />
              </label>
              <label className="text-sm text-ink-soft">
                Apellido
                <input
                  value={datos.last_name}
                  onChange={(e) => setDatos({ ...datos, last_name: e.target.value })}
                  className={`${campo} mt-1`}
                />
              </label>
            </div>
            <label className="text-sm text-ink-soft block mt-4">
              Correo
              <input
                type="email"
                value={datos.email}
                onChange={(e) => setDatos({ ...datos, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className={`${campo} mt-1`}
              />
              <span className="block text-xs text-muted mt-1.5">
                Sin correo no se puede recuperar la contraseña si la olvidas.
              </span>
            </label>

            {avisoDatos && <p className="text-sm text-success font-medium mt-3">{avisoDatos}</p>}
            {errorDatos && <p className="text-sm text-danger font-medium mt-3">{errorDatos}</p>}

            <button
              disabled={guardando}
              className="mt-4 bg-ph-yellow text-ph-black font-semibold text-sm rounded-md px-4 py-2.5 hover:bg-ph-yellow-dark transition-colors disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar datos"}
            </button>
          </form>

          <form
            onSubmit={cambiarPassword}
            className="bg-surface border border-border rounded-lg p-5"
          >
            <p className="text-xs font-mono uppercase tracking-wide text-muted mb-4">
              Cambiar contraseña
            </p>
            <label className="text-sm text-ink-soft block">
              Contraseña actual
              <input
                type="password"
                autoComplete="current-password"
                value={pass.actual}
                onChange={(e) => setPass({ ...pass, actual: e.target.value })}
                required
                className={`${campo} mt-1`}
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <label className="text-sm text-ink-soft">
                Nueva
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pass.nueva}
                  onChange={(e) => setPass({ ...pass, nueva: e.target.value })}
                  required
                  className={`${campo} mt-1`}
                />
              </label>
              <label className="text-sm text-ink-soft">
                Repítela
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pass.nueva2}
                  onChange={(e) => setPass({ ...pass, nueva2: e.target.value })}
                  required
                  className={`${campo} mt-1`}
                />
              </label>
            </div>
            <p className="text-xs text-muted mt-2">
              Mínimo 8 caracteres y que no sea sólo números.
            </p>

            {avisoPass && <p className="text-sm text-success font-medium mt-3">{avisoPass}</p>}
            {errorPass && <p className="text-sm text-danger font-medium mt-3">{errorPass}</p>}

            <button
              disabled={cambiando}
              className="mt-4 bg-ph-black text-ph-yellow font-semibold text-sm rounded-md px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {cambiando ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </form>
        </div>

        <div className="bg-surface-sidebar text-white rounded-lg p-5 relative overflow-hidden">
          <div className="hazard-stripes absolute top-0 inset-x-0 h-1.5" />
          <p className="text-xs font-mono uppercase tracking-wide text-ph-yellow mt-1 mb-3">
            Tu cuenta
          </p>
          <div className="[&_span:first-child]:text-white/50 [&_span:last-child]:text-white [&>div]:border-white/10">
            <Dato etiqueta="Usuario" valor={user?.username} />
            <Dato etiqueta="Rol" valor={ROLES[user?.rol] || user?.rol} />
            <Dato etiqueta="Departamento" valor={user?.departamento_nombre} />
            <Dato etiqueta="Estación" valor={user?.estacion_nombre} />
            <Dato etiqueta="Estado" valor={user?.activo ? "Activa" : "Desactivada"} />
          </div>
          <p className="text-xs text-white/50 mt-4 leading-relaxed">
            El rol, el departamento y la estación sólo los puede cambiar un administrador
            global desde la pantalla de Usuarios.
          </p>
        </div>
      </div>
    </div>
  );
}
