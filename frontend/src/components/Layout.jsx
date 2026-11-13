import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RolBadge } from "./Badges";
import {
  TicketIcon,
  PlusCircleIcon,
  ChartIcon,
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

const navItemBase =
  "flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors";

function NavItem({ to, children, icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${navItemBase} ${
          isActive
            ? "bg-ph-yellow text-ph-black"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      <span className="shrink-0 opacity-90">{icon}</span>
      {children}
    </NavLink>
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

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem to="/" end icon={<TicketIcon />} onNavigate={cerrarMenu}>
            Tickets
          </NavItem>
          {puedeCrearTicket && (
            <NavItem to="/tickets/nuevo" icon={<PlusCircleIcon />} onNavigate={cerrarMenu}>
              Nuevo ticket
            </NavItem>
          )}
          {isAdmin && (
            <NavItem to="/dashboard" icon={<ChartIcon />} onNavigate={cerrarMenu}>
              Dashboard
            </NavItem>
          )}
          <NavItem to="/mapa" icon={<MapIcon />} onNavigate={cerrarMenu}>
            Mapa
          </NavItem>
          <NavItem to="/reportes" icon={<ReportIcon />} onNavigate={cerrarMenu}>
            Reportes
          </NavItem>
          {isAdmin && (
            <NavItem to="/dispositivos" icon={<ChipIcon />} onNavigate={cerrarMenu}>
              Dispositivos
            </NavItem>
          )}
          {user?.rol === "admin_global" && (
            <NavItem to="/usuarios" icon={<UsersIcon />} onNavigate={cerrarMenu}>
              Usuarios
            </NavItem>
          )}
          {user?.rol === "admin_global" && (
            <NavItem to="/departamentos" icon={<BuildingIcon />} onNavigate={cerrarMenu}>
              Departamentos
            </NavItem>
          )}
          {user?.rol === "admin_global" && (
            <NavItem to="/categorias" icon={<TagIcon />} onNavigate={cerrarMenu}>
              Categorías
            </NavItem>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-2.5 mb-3.5">
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
          </div>
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
