import { createContext, useContext, useState, useEffect } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("petrohelp_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("petrohelp_token");
    if (!token) {
      setLoading(false);
      return;
    }
    // Verifica que el token siga siendo valido y refresca los datos del usuario.
    client
      .get("/auth/me/")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("petrohelp_user", JSON.stringify(res.data));
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // El navegador comparte el almacenamiento entre TODAS las pestañas del
  // mismo sitio, así que solo puede haber una sesión abierta a la vez.
  // Si en otra pestaña se inicia o se cierra sesión, esta pestaña se
  // sincroniza para no mezclar los datos de dos usuarios distintos
  // (antes seguía mostrando un rol mientras el servidor ya respondía a otro).
  useEffect(() => {
    function alCambiarSesionEnOtraPestana(e) {
      if (e.key && e.key !== "petrohelp_token" && e.key !== "petrohelp_user") return;

      const token = localStorage.getItem("petrohelp_token");
      if (!token) {
        setUser(null); // cerraron sesión en otra pestaña
        return;
      }

      let otro = null;
      try {
        const guardado = localStorage.getItem("petrohelp_user");
        otro = guardado ? JSON.parse(guardado) : null;
      } catch {
        otro = null;
      }
      // Entraron con una cuenta distinta: se recarga para mostrarla completa.
      if (otro && otro.id !== user?.id) window.location.reload();
    }

    window.addEventListener("storage", alCambiarSesionEnOtraPestana);
    return () => window.removeEventListener("storage", alCambiarSesionEnOtraPestana);
  }, [user]);

  async function login(username, password) {
    const res = await client.post("/auth/login/", { username, password });
    const { token } = res.data;
    localStorage.setItem("petrohelp_token", token);

    const meRes = await client.get("/auth/me/");
    setUser(meRes.data);
    localStorage.setItem("petrohelp_user", JSON.stringify(meRes.data));
    return meRes.data;
  }

  // Alta publica: el backend solo crea usuarios con rol operador y
  // devuelve el token, asi que la persona entra de inmediato.
  async function registrar(datos) {
    const res = await client.post("/auth/registro/", datos);
    const { token, usuario } = res.data;
    localStorage.setItem("petrohelp_token", token);
    setUser(usuario);
    localStorage.setItem("petrohelp_user", JSON.stringify(usuario));
    return usuario;
  }

  // Vuelve a pedir los datos del usuario (tras editar el perfil).
  async function refrescarUsuario() {
    const res = await client.get("/auth/me/");
    setUser(res.data);
    localStorage.setItem("petrohelp_user", JSON.stringify(res.data));
    return res.data;
  }

  // Al cambiar la contrasena el servidor emite un token nuevo.
  function guardarToken(token) {
    if (token) localStorage.setItem("petrohelp_token", token);
  }

  function logout() {
    localStorage.removeItem("petrohelp_token");
    localStorage.removeItem("petrohelp_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, registrar, refrescarUsuario, guardarToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
