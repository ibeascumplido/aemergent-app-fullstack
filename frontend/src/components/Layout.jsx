import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, Calendar, Users, LogOut, User, Building2, CalendarDays, Menu, X, Camera, ChevronDown, MapPin, UsersRound, Truck, Wrench, Shirt } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import NotificationBell from "./NotificationBell";

const Layout = () => {
  const { user, isAdmin, isPending, canBudgets, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [planificacionAbierta, setPlanificacionAbierta] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Navigation items based on role
  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Inicio", show: true, section: "personal" },
    { to: "/my-calendar", icon: Calendar, label: "Mi Calendario", show: true, section: "personal" },
    {
      label: "Planificación",
      icon: CalendarDays,
      show: isAdmin,
      section: "admin",
      dropdown: true,
      children: [
        { to: "/clients/galp/locations/calendar", icon: MapPin, label: "GALP" },
        { to: "/planificacion", icon: UsersRound, label: "Operarios" },
        { to: "/calendar", icon: Calendar, label: "Vacaciones" },
      ],
    },
    { to: "/fotos-por-clasificar", icon: Camera, label: "Fotos", show: isAdmin, section: "admin" },
    { to: "/budgets", icon: FileText, label: "Presupuestos", show: canBudgets, section: "admin" },
    { to: "/clients", icon: Building2, label: "Clientes", show: canBudgets, section: "admin" },
    { to: "/vehiculos", icon: Truck, label: "Vehículos", show: isAdmin, section: "admin" },
    { to: "/maquinaria", icon: Wrench, label: "Maquinaria", show: isAdmin, section: "admin" },
    { to: "/ropa", icon: Shirt, label: "Ropa", show: isAdmin, section: "admin" },
    { to: "/admin/users", icon: Users, label: "Usuarios", show: isAdmin, section: "admin" },
  ].filter(item => item.show);

  const itemsPersonales = navItems.filter((i) => i.section === "personal");
  const itemsAdmin = navItems.filter((i) => i.section === "admin");

  const hijoActivo = (item) =>
    item.dropdown && item.children.some((h) => location.pathname.startsWith(h.to));

  const renderNavLink = (item, resaltado) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive
            ? "bg-red-50 text-red-600 font-medium"
            : resaltado
            ? "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`
      }
      data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <item.icon className="w-5 h-5" />
      <span>{item.label}</span>
    </NavLink>
  );

  const renderDropdown = (item) => {
    const activo = hijoActivo(item);
    const abierto = planificacionAbierta || activo;
    return (
      <div key={item.label}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPlanificacionAbierta((v) => !v);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
            activo
              ? "bg-red-50 text-red-600 font-medium"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
          data-testid="nav-planificacion-toggle"
        >
          <item.icon className="w-5 h-5" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${abierto ? "rotate-180" : ""}`}
          />
        </button>
        {abierto && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-100 pl-3">
            {item.children.map((hijo) => (
              <NavLink
                key={hijo.to}
                to={hijo.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-red-50 text-red-600 font-medium"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
                data-testid={`nav-${hijo.label.toLowerCase()}`}
              >
                <hijo.icon className="w-4 h-4" />
                <span>{hijo.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white" data-testid="app-layout">
      {/* Boton para abrir el menu, solo visible en movil (el sidebar ya es fijo en escritorio) */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-white border border-slate-200 shadow-sm"
        data-testid="abrir-menu-btn"
      >
        <Menu className="w-5 h-5 text-slate-700" />
      </button>

      {/* Fondo oscuro detras del menu en movil, cierra al tocar fuera */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
          data-testid="overlay-menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 border-r border-slate-100 bg-white z-50 flex flex-col transition-transform duration-200 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
        data-testid="sidebar"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <img 
            src="https://customer-assets.emergentagent.com/job_presupuesto-app-27/artifacts/yunqqtir_logo-final.png" 
            alt="INICIA" 
            className="h-10 w-auto"
          />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-700"
              data-testid="cerrar-menu-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <nav className="p-4 space-y-1 flex-1" onClick={() => setSidebarOpen(false)}>
          {itemsPersonales.map((item) => renderNavLink(item, false))}

          {itemsAdmin.length > 0 && (
            <div className="pt-3 mt-2 border-t border-slate-100">
              <p className="px-4 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Administración
              </p>
              <div className="space-y-1">
                {itemsAdmin.map((item) =>
                  item.dropdown ? renderDropdown(item) : renderNavLink(item, true)
                )}
              </div>
            </div>
          )}
        </nav>

        {/* User info & logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg mb-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: user?.color || "#3B82F6" }}
            >
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                user?.abreviatura || user?.name?.slice(0, 2).toUpperCase() || <User className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate text-sm">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              {isPending && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                  Pendiente
                </span>
              )}
              {isAdmin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                  Admin
                </span>
              )}
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="p-4 pt-16 md:p-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
};

export default Layout;
