import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RolBadge } from "./Badges";
import {
  TicketIcon,
  PlusCircleIcon,
  ChartIcon,
  InboxIcon,
  StationIcon,
  LogIcon,
  UsersIcon,
  BuildingIcon,
  TagIcon,
  ChipIcon,
  ReportIcon,
  MapIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from "./Icons";
import NotificationBell from "./NotificationBell";
import ChatBot from "./ChatBot";
import logo from "../assets/petrohelp_logo.svg";

function NavItem({ to, children, icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-ph-yellow/10 text-white"
            : "text-white/60 hover:text-white hover:bg-white/[0.04]"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Barrita indicadora */}
          <span
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-ph-yellow transition-all duration-200 ${
              isActive ? "h-6 opacity-100" : "h-0 opacity-0"
            }`}
          />
          <span
            className={`w-8 h-8 shrink-0 rounded-md flex items-center justify-center transition-colors ${
              isActive
                ? "bg-ph-yellow text-ph-black"
                : "bg-white/[0.05] text-white/70 group-hover:bg-white/10 group-hover:text-ph-yellow"
            }`}
          >
            {icon}
          </span>
          <span className="truncate">{children}</span>
        </>
      )}
    </NavLink>
  );
}

function SeccionNav({ titulo, children }) {
  return (
    <div>
      <p className="px-3 mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-white/35">
        {titulo}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const isAdmin = user?.rol === "admin_global" || user?.rol === "admin_departamento";
  // El admin_global no crea tickets: no tiene sentido que el
  // supervisor general reporte una incidencia sobre si mismo.
  const puedeCrearTicket = user?.rol !== "admin_global";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function cerrarMenu() {
    setMenuAbierto(false);
  }

  return (
    <div className="min-h-screen flex bg-surface-alt">
      {/* Barra superior, solo en móvil */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-surface-sidebar flex items-center justify-between px-4 border-b-2 border-ph-yellow">
        <button
          onClick={() => setMenuAbierto(true)}
          className="text-white/80 hover:text-white p-1 -ml-1"
          aria-label="Abrir menú"
        >
          <MenuIcon />
        </button>
        <div className="flex items-center gap-2">
          <img src={logo} alt="PetroHelp" className="w-9 h-9" />
          <span className="font-display text-lg font-semibold tracking-wide text-white">
            PetroHelp
          </span>
        </div>
        <NotificationBell />
      </div>

      {/* Fondo oscuro al abrir el menú en móvil */}
      {menuAbierto && (
        <div
          onClick={cerrarMenu}
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 shrink-0 bg-surface-sidebar flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:translate-x-0 ${
          menuAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="PetroHelp" className="w-12 h-12 shrink-0" />
            <div>
              <span className="font-display text-xl font-semibold tracking-wide text-white block leading-none">
                PetroHelp
              </span>
              <p className="text-xs text-white/50 mt-1 font-mono">
                Prevenimos antes de que pase
              </p>
            </div>
          </div>
          <div className="hidden lg:block shrink-0">
            <NotificationBell align="left" />
          </div>
          <button
            onClick={cerrarMenu}
            className="lg:hidden text-white/60 hover:text-white p-1"
            aria-label="Cerrar menú"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          <SeccionNav titulo="Operación">
            <NavItem to="/" end icon={<TicketIcon />} onNavigate={cerrarMenu}>
              Tickets
            </NavItem>
            {puedeCrearTicket && (
              <NavItem to="/tickets/nuevo" icon={<PlusCircleIcon />} onNavigate={cerrarMenu}>
                Nuevo ticket
              </NavItem>
            )}
            <NavItem to="/mapa" icon={<MapIcon />} onNavigate={cerrarMenu}>
              Mapa
            </NavItem>
            <NavItem to="/reportes" icon={<ReportIcon />} onNavigate={cerrarMenu}>
              Reportes
            </NavItem>
          </SeccionNav>

          {isAdmin && (
            <SeccionNav titulo="Monitoreo">
              <NavItem to="/cola" icon={<InboxIcon />} onNavigate={cerrarMenu}>
                Cola de trabajo
              </NavItem>
              <NavItem to="/dashboard" icon={<ChartIcon />} onNavigate={cerrarMenu}>
                Dashboard
              </NavItem>
              <NavItem to="/dispositivos" icon={<ChipIcon />} onNavigate={cerrarMenu}>
                Dispositivos
              </NavItem>
            </SeccionNav>
          )}

          {user?.rol === "admin_global" && (
            <SeccionNav titulo="Administración">
              <NavItem to="/usuarios" icon={<UsersIcon />} onNavigate={cerrarMenu}>
                Usuarios
              </NavItem>
              <NavItem to="/departamentos" icon={<BuildingIcon />} onNavigate={cerrarMenu}>
                Departamentos
              </NavItem>
              <NavItem to="/estaciones" icon={<StationIcon />} onNavigate={cerrarMenu}>
                Estaciones
              </NavItem>
              <NavItem to="/auditoria" icon={<LogIcon />} onNavigate={cerrarMenu}>
                Bitácora
              </NavItem>
              <NavItem to="/categorias" icon={<TagIcon />} onNavigate={cerrarMenu}>
                Categorías
              </NavItem>
            </SeccionNav>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <NavLink
            to="/perfil"
            onClick={cerrarMenu}
            className={({ isActive }) =>
              `flex items-center gap-2.5 mb-3.5 rounded-md px-2 py-1.5 -mx-2 transition-colors ${
                isActive ? "bg-white/10" : "hover:bg-white/5"
              }`
            }
            title="Mi perfil"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold font-display shrink-0">
              {(user?.first_name || user?.username || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {user?.first_name || user?.username}
              </p>
              <div className="mt-1">
                <RolBadge rol={user?.rol} />
              </div>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-left text-xs font-medium text-white/50 hover:text-ph-yellow transition-colors font-mono uppercase tracking-wide"
          >
            <LogoutIcon />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </div>
      </main>

      <ChatBot user={user} />
    </div>
  );
}
