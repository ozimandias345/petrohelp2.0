import axios from "axios";

// Usa el mismo host desde el que se abrió la página (localhost, tu IP de
// red, etc.) para hablarle al backend en el puerto 8000. Así funciona
// igual entrando desde la compu (http://localhost:5173) que desde el
// celular (http://192.168.x.x:5173), sin tener que tocar este archivo.
export const API_BASE_URL = `http://${window.location.hostname}:8000/api`;

const client = axios.create({
  baseURL: API_BASE_URL,
});

// Agrega el token guardado a cada peticion automaticamente.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("petrohelp_token");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Si el token ya no es valido (401), cierra la sesion local.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("petrohelp_token");
      localStorage.removeItem("petrohelp_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default client;
