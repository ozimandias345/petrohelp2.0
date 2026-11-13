import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/petrohelp_logo.svg";

const REMEMBER_KEY = "petrohelp_remember_user";

// Hexágono (evoca moléculas de hidrocarburo) como path SVG
const HEX = "M50 3 93 27v46L50 97 7 73V27Z";

// Mensajes que rotan debajo del formulario
const CONSEJOS = [
  { tag: "Consejo de seguridad", texto: "Revisa mangueras y pistolas de despacho al inicio de cada turno; una fisura pequeña hoy evita un derrame mañana." },
  { tag: "¿Sabías que?", texto: "Los sensores de PetroHelp vigilan gas, temperatura y nivel de tanques las 24 horas, aunque nadie esté mirando la pantalla." },
  { tag: "Consejo de seguridad", texto: "Mantén los extintores visibles, sin obstáculos y con su revisión al día." },
  { tag: "¿Sabías que?", texto: "Cuando un sensor detecta gas fuera de rango, el ticket se crea solo con prioridad alta y se notifica al departamento." },
  { tag: "Consejo de seguridad", texto: "Reporta cualquier derrame, aunque sea pequeño: prevenir siempre cuesta menos que reparar." },
  { tag: "¿Sabías que?", texto: "Puedes reportar un problema escribiéndole a PetroBot, el asistente del sistema, y él crea el ticket por ti." },
  { tag: "Consejo de seguridad", texto: "Durante la descarga de combustible, delimita la zona y mantén a los clientes alejados de la pipa." },
];

function ConsejosRotativos() {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    if (pausa) return;
    const id = setInterval(() => {
      setVisible(false); // se desvanece...
      setTimeout(() => {
        setI((n) => (n + 1) % CONSEJOS.length); // ...cambia...
        setVisible(true); // ...y aparece el siguiente
      }, 450);
    }, 5500);
    return () => clearInterval(id);
  }, [pausa]);

  function irA(n) {
    setVisible(false);
    setTimeout(() => {
      setI(n);
      setVisible(true);
    }, 250);
  }

  const c = CONSEJOS[i];
  return (
    <div
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      className="mt-6 bg-surface/95 border border-border rounded-xl px-5 py-4 shadow-sm"
    >
      <div
        className={`transition-all duration-500 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
        }`}
      >
        <p className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wide text-ink">
          <span className="w-2 h-2 rounded-full bg-ph-yellow ring-2 ring-ph-yellow/30" />
          {c.tag}
        </p>
        <p className="text-sm text-ink-soft mt-1.5 leading-relaxed min-h-[2.75rem]">{c.texto}</p>
      </div>
      <div className="flex gap-1.5 mt-3">
        {CONSEJOS.map((_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => irA(n)}
            aria-label={`Ver mensaje ${n + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              n === i ? "w-6 bg-ph-yellow" : "w-1.5 bg-border hover:bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Figuras geométricas decorativas del lado del formulario (solo escritorio)
function FigurasFormulario() {
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Triángulo de advertencia (contorno) */}
      <svg viewBox="0 0 100 90" className="flotar-lento absolute top-[9%] left-[7%] w-40 xl:w-52" style={{ "--rot": "-12deg" }}>
        <path d="M50 4 96 86H4Z" fill="none" stroke="#ffc400" strokeWidth="5" strokeLinejoin="round" />
        <path d="M50 34v24M50 68v4" stroke="#111" strokeWidth="6" strokeLinecap="round" />
      </svg>

      {/* Grupo de hexágonos */}
      <svg viewBox="0 0 200 180" className="flotar absolute bottom-[8%] left-[5%] w-56 xl:w-72 opacity-90">
        <g fill="none" strokeWidth="3">
          <path d={HEX} stroke="#111" strokeOpacity=".18" />
          <path d={HEX} transform="translate(86 0)" stroke="#ffc400" />
          <path d={HEX} transform="translate(43 74)" stroke="#111" strokeOpacity=".18" />
        </g>
        <path d={HEX} transform="translate(129 74) scale(.5)" fill="#ffc400" />
      </svg>

      {/* Bloque con franjas de precaución, saliendo por la esquina */}
      <div className="absolute -right-16 bottom-[14%] w-64 h-16 rotate-[-35deg] hazard-stripes rounded-sm opacity-90 shadow-lg" />

      {/* Círculo amarillo sólido parcialmente fuera */}
      <div className="absolute -right-24 top-[22%] w-56 h-56 rounded-full bg-ph-yellow" />
      <div className="absolute right-20 top-[18%] w-24 h-24 rounded-full border-[6px] border-ph-black/80" />

      {/* Cuadrado negro rotado */}
      <div className="flotar absolute right-[24%] bottom-[7%] w-14 h-14 bg-ph-black rounded-md" style={{ "--rot": "45deg" }} />

      {/* Cruces pequeñas */}
      {[["12%", "48%"], ["30%", "84%"], ["78%", "40%"], ["62%", "12%"]].map(([top, left]) => (
        <span key={top + left} className="absolute text-ph-black/25 text-2xl font-bold leading-none" style={{ top, left }}>+</span>
      ))}
    </div>
  );
}

// Figuras del panel oscuro
function FigurasPanel() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Cuadrados concéntricos rotados */}
      <div className="absolute -right-32 -bottom-32 w-[460px] h-[460px] rotate-45 border-2 border-ph-yellow/25 rounded-3xl" />
      <div className="absolute -right-10 -bottom-10 w-[300px] h-[300px] rotate-45 border-2 border-ph-yellow/40 rounded-2xl" />
      <div className="absolute right-16 bottom-16 w-[140px] h-[140px] rotate-45 bg-ph-yellow/90 rounded-xl" />
      {/* Hexágonos tenues arriba a la derecha */}
      <svg viewBox="0 0 200 180" className="flotar-lento absolute top-[10%] right-[8%] w-64 opacity-60">
        <g fill="none" stroke="#ffffff" strokeOpacity=".12" strokeWidth="2.5">
          <path d={HEX} /><path d={HEX} transform="translate(86 0)" /><path d={HEX} transform="translate(43 74)" />
        </g>
      </svg>
      {/* Puntos */}
      <div
        className="absolute left-0 bottom-0 w-80 h-64 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,196,0,0.5) 1.5px, transparent 1.5px)",
          backgroundSize: "18px 18px",
          maskImage: "linear-gradient(to top right, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to top right, black, transparent 70%)",
        }}
      />
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path
        d="M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 1.5c-3.04 0-6.5 1.52-6.5 3.5v1.25a.75.75 0 0 0 .75.75h11.5a.75.75 0 0 0 .75-.75V15c0-1.98-3.46-3.5-6.5-3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path
        d="M5.5 8.5V6.75a4.5 4.5 0 1 1 9 0V8.5h.25c.966 0 1.75.784 1.75 1.75v5c0 .966-.784 1.75-1.75 1.75h-9.5A1.75 1.75 0 0 1 3.5 15.25v-5c0-.966.784-1.75 1.75-1.75H5.5Zm1.5 0h6V6.75a3 3 0 1 0-6 0V8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      {off ? (
        <path
          d="M3 3l14 14M8.53 8.61a2.25 2.25 0 0 0 2.86 2.86M6.3 6.32C4.42 7.4 3 9 2.25 10c1.32 2.5 4.14 5.25 7.75 5.25 1.36 0 2.56-.39 3.58-.98M9.15 4.78c.28-.02.56-.03.85-.03 3.61 0 6.43 2.75 7.75 5.25a11 11 0 0 1-1.9 2.53"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M2.25 10S4.98 4.75 10 4.75 17.75 10 17.75 10 15.02 15.25 10 15.25 2.25 10 2.25 10Z M12.25 10a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function Login() {
  const [username, setUsername] = useState(
    () => localStorage.getItem(REMEMBER_KEY) || ""
  );
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(
    () => !!localStorage.getItem(REMEMBER_KEY)
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, username);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      navigate("/");
    } catch {
      setError("Usuario o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.15fr_1fr] bg-surface-alt">
      {/* Panel de marca (solo en pantallas grandes) */}
      <section className="hidden lg:flex relative flex-col justify-between overflow-hidden bg-surface-sidebar text-white px-14 xl:px-20 py-14">
        <div className="hazard-stripes absolute top-0 inset-x-0 h-3" />
        <FigurasPanel />

        <div className="relative flex items-center gap-5 animate-fade-up">
          <img
            src={logo}
            alt="PetroHelp"
            className="w-20 h-20 2xl:w-24 2xl:h-24 drop-shadow-[0_6px_18px_rgba(255,196,0,0.3)]"
          />
          <div>
            <p className="font-display text-4xl 2xl:text-5xl font-semibold tracking-wide leading-none text-white">PetroHelp</p>
            <p className="text-base 2xl:text-lg text-ph-yellow font-medium mt-2">Gestión preventiva para gasolineras</p>
          </div>
        </div>

        <div className="relative max-w-xl 2xl:max-w-2xl animate-fade-up">
          <p className="text-sm 2xl:text-base font-mono font-semibold uppercase tracking-[0.2em] text-ph-yellow mb-5">
            Seguridad · Monitoreo · Respuesta
          </p>
          <h1 className="font-display text-5xl xl:text-6xl 2xl:text-7xl font-semibold leading-[1.05] tracking-wide">
            Prevenimos antes <br />
            de que <span className="text-ph-yellow">pase</span>.
          </h1>
          <p className="text-white/70 text-lg 2xl:text-xl mt-6 leading-relaxed">
            Sensores en cada estación detectan riesgos a tiempo y generan la incidencia
            automáticamente, para que tu equipo actúe antes de que sea un problema.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              ["Monitoreo IoT 24/7", "Gas, temperatura y nivel de tanques en tiempo real."],
              ["Alertas automáticas", "La IA clasifica el riesgo y abre el ticket al instante."],
              ["Seguimiento hasta el cierre", "Cada incidencia con responsable, historial y evidencia."],
            ].map(([titulo, texto]) => (
              <li key={titulo} className="flex gap-4">
                <span className="mt-1 w-7 h-7 shrink-0 rounded-md bg-ph-yellow text-ph-black flex items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-4 h-4">
                    <path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-white 2xl:text-lg">{titulo}</p>
                  <p className="text-sm 2xl:text-base text-white/60 mt-0.5">{texto}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Ejemplo visual del monitoreo (ilustrativo) */}
          <div className="mt-12 bg-white/[0.04] border border-white/10 rounded-xl p-5 max-w-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono uppercase tracking-wide text-white/50">
                Ejemplo · Tanque Magna, Estación 1
              </p>
              <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="w-2 h-2 rounded-full bg-success" /> Todo en orden
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Gas", "42", "ppm", 14],
                ["Temperatura", "26.4", "°C", 53],
                ["Tanque", "68", "%", 68],
              ].map(([nombre, valor, unidad, pct]) => (
                <div key={nombre} className="bg-white/[0.05] rounded-lg p-3">
                  <p className="text-[11px] font-mono uppercase tracking-wide text-white/45">{nombre}</p>
                  <p className="font-display text-2xl font-semibold mt-0.5">
                    {valor}
                    <span className="text-xs font-body font-normal text-white/50 ml-0.5">{unidad}</span>
                  </p>
                  <div className="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-ph-yellow" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative self-start flex items-center gap-3 bg-ph-black border border-ph-yellow/40 rounded-lg px-4 py-3">
          <span className="w-8 h-8 shrink-0 rounded-md bg-ph-yellow text-ph-black flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2H8Z" />
            </svg>
          </span>
          <p className="text-sm 2xl:text-base text-white/90">
            <span className="font-semibold text-white">Sistema interno.</span>{" "}
            Acceso restringido a personal autorizado.
          </p>
        </div>
      </section>

      {/* Formulario */}
      <section className="relative flex items-center justify-center overflow-hidden p-6 sm:p-10">
        {/* Cuadrícula de puntos tipo plano técnico + brillo amarillo (escritorio) */}
        <div
          className="hidden lg:block absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(17,17,17,0.13) 1.2px, transparent 1.2px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,196,0,0.28), transparent 65%)" }}
        />
        <FigurasFormulario />
        <div className="hidden lg:flex absolute top-8 right-10 items-center gap-2.5 bg-surface border border-border rounded-full px-5 py-2 text-base font-medium text-ink shadow-md">
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-success" />
          </span>
          Sistema operativo
        </div>

        {/* Fondo diagonal solo en móvil/tablet (en escritorio lo sustituye el panel) */}
        <div
          className="lg:hidden absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(128deg," +
              "var(--color-surface-alt) 0%, var(--color-surface-alt) 36%," +
              "var(--color-ink) 36%, var(--color-ink) 55%," +
              "var(--color-ph-yellow) 55%, var(--color-ph-yellow) 70%," +
              "var(--color-surface-alt) 70%, var(--color-surface-alt) 100%)",
          }}
        />

      {/* Tarjeta */}
      <div className="relative w-full max-w-md xl:max-w-lg animate-fade-up">
        {/* Saludo (escritorio) */}
        <div className="hidden lg:block mb-8">
          <h2 className="font-display text-4xl xl:text-5xl font-semibold text-ink tracking-wide">
            Bienvenido de nuevo
          </h2>
          <p className="text-muted mt-2 text-base xl:text-lg">
            Ingresa con tu usuario de PetroHelp para continuar.
          </p>
        </div>

        <div className="bg-surface rounded-2xl overflow-hidden shadow-2xl shadow-black/15 lg:border lg:border-border">
          <div className="hazard-stripes h-3" />
          <div className="lg:hidden bg-surface-sidebar px-9 pt-9 pb-20 text-center">
            <span className="font-display text-3xl font-semibold tracking-wide text-white">
              PetroHelp
            </span>
            <p className="text-sm text-white/60 font-mono mt-1.5">
              Prevenimos antes de que pase
            </p>
          </div>

          <div className="px-9 pb-10 lg:px-10 xl:px-12 lg:pt-10 xl:pt-12 lg:pb-12">
            <div className="lg:hidden flex justify-center -mt-16 mb-8">
              <img
                src={logo}
                alt="PetroHelp"
                className="w-32 h-32 drop-shadow-lg"
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="relative">
                <span className="absolute left-0 bottom-3 text-muted/70">
                  <UserIcon />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-transparent border-0 border-b-2 border-border pl-8 pr-0 py-2.5 text-lg text-ink placeholder-muted/60 focus:outline-none focus:border-ph-yellow transition-colors"
                  placeholder="Usuario"
                />
              </div>

              <div className="relative">
                <span className="absolute left-0 bottom-3 text-muted/70">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-transparent border-0 border-b-2 border-border pl-8 pr-9 py-2.5 text-lg text-ink placeholder-muted/60 focus:outline-none focus:border-ph-yellow transition-colors"
                  placeholder="Contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-0 bottom-3 text-muted/70 hover:text-ink transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 text-sm text-ink-soft cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={remember}
                    onClick={() => setRemember((v) => !v)}
                    className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${
                      remember ? "bg-ph-yellow" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        remember ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                  Recordarme
                </label>
                <span className="text-xs text-muted">
                  ¿Problemas para entrar?
                </span>
              </div>

              {error && (
                <p className="text-sm text-danger font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ph-yellow text-ph-black font-semibold rounded-lg py-3.5 text-lg hover:bg-ph-yellow-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-ph-yellow/40"
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </button>
            </form>
          </div>
        </div>

        <ConsejosRotativos />

        <p className="lg:hidden text-center mt-6">
          <span className="inline-block text-xs text-ink-soft font-mono bg-surface/90 rounded px-3 py-1">
            Sistema interno · Acceso restringido a personal autorizado
          </span>
        </p>
      </div>
      </section>
    </div>
  );
}
