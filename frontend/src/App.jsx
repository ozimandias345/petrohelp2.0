import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";
import Login from "./pages/Login";
import TicketList from "./pages/TicketList";
import TicketDetail from "./pages/TicketDetail";
import CreateTicket from "./pages/CreateTicket";
import AdminDashboard from "./pages/AdminDashboard";
import UserList from "./pages/UserList";
import CreateUser from "./pages/CreateUser";
import DepartmentList from "./pages/DepartmentList";
import CategoryList from "./pages/CategoryList";
import Dispositivos from "./pages/Dispositivos";
import Reportes from "./pages/Reportes";
import Mapa from "./pages/Mapa";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <Spinner full />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  const esAdmin = user?.rol === "admin_global" || user?.rol === "admin_departamento";
  if (!esAdmin) return <Navigate to="/" replace />;
  return children;
}

function CrearTicketRoute({ children }) {
  const { user } = useAuth();
  // El admin_global no crea tickets: no tiene sentido que el
  // supervisor general reporte una incidencia sobre si mismo.
  if (user?.rol === "admin_global") return <Navigate to="/" replace />;
  return children;
}

function AdminGlobalRoute({ children }) {
  const { user } = useAuth();
  if (user?.rol !== "admin_global") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/" element={<TicketList />} />
            <Route
              path="/tickets/nuevo"
              element={
                <CrearTicketRoute>
                  <CreateTicket />
                </CrearTicketRoute>
              }
            />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route
              path="/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route
              path="/dispositivos"
              element={
                <AdminRoute>
                  <Dispositivos />
                </AdminRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <AdminGlobalRoute>
                  <UserList />
                </AdminGlobalRoute>
              }
            />
            <Route
              path="/usuarios/nuevo"
              element={
                <AdminGlobalRoute>
                  <CreateUser />
                </AdminGlobalRoute>
              }
            />
            <Route
              path="/departamentos"
              element={
                <AdminGlobalRoute>
                  <DepartmentList />
                </AdminGlobalRoute>
              }
            />
            <Route
              path="/categorias"
              element={
                <AdminGlobalRoute>
                  <CategoryList />
                </AdminGlobalRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
