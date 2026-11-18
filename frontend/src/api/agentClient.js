import axios from "axios";

// Cliente para el agente ESP32 (FastAPI, puerto 8001).
// Usa el mismo token de Django: el agente lo valida contra /api/auth/me/.
export const AGENT_BASE_URL =
  import.meta.env.VITE_AGENT_URL || `http://${window.location.hostname}:8001/api`;

const agentClient = axios.create({
  baseURL: AGENT_BASE_URL,
  // ngrok gratis muestra una pantalla de advertencia al navegador antes de
  // dejar pasar la peticion. Esta cabecera se la salta.
  headers: { "ngrok-skip-browser-warning": "true" },
});

agentClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("petrohelp_token");
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

export default agentClient;
