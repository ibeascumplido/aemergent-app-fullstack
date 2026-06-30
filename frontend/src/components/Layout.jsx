import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Calendar, Users, LogOut, User, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import NotificationBell from "./NotificationBell";

const Layout = () => {
  const { user, isAdmin, isPending, canBudgets, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Navigation items based on role
  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Inicio", show: true },
    { to: "/my-calendar", icon: Calendar, label: "Mi Calendario", show: true },
    { to: "/budgets", icon: FileText, label: "Presupuestos", show: canBudgets },
    { to: "/clients", icon: Building2, label: "Clientes", show: canBudgets },
    { to: "/calendar", icon: Calendar, label: "Calendarios", show: isAdmin },
    { to: "/admin/users", icon: Users, label: "Usuarios", show: isAdmin },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen bg-white" data-testid="app-layout">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-100 bg-white z-50 flex flex-col" data-testid="sidebar">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <img 
            src="https://customer-assets.emergentagent.com/job_presupuesto-app-27/artifacts/yunqqtir_logo-final.png" 
            alt="INICIA" 
            className="h-10 w-auto"
          />
          <NotificationBell />
        </div>
        
        <nav className="p-4 space-y-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-red-50 text-red-600 font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
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
      <main className="ml-64 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="p-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
};

export default Layout;
