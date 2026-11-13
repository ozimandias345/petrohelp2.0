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

  async function login(username, password) {
    const res = await client.post("/auth/login/", { username, password });
    const { token } = res.data;
    localStorage.setItem("petrohelp_token", token);

    const meRes = await client.get("/auth/me/");
    setUser(meRes.data);
    localStorage.setItem("petrohelp_user", JSON.stringify(meRes.data));
    return meRes.data;
  }

  function logout() {
    localStorage.removeItem("petrohelp_token");
    localStorage.removeItem("petrohelp_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
