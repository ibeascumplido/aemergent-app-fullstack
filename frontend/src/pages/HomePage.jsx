import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Calendar, Clock, CheckCircle, ArrowRight, Palmtree, Sun, Users, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import FotosPendientesAviso from "@/components/FotosPendientesAviso";
import FotoRapidaFlow from "@/components/FotoRapidaFlow";
import ParteRapidoFlow from "@/components/ParteRapidoFlow";
import SolicitudRopaFlow from "@/components/SolicitudRopaFlow";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

const HomePage = () => {
  const { user, isAdmin, isPending } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentBudgets, setRecentBudgets] = useState([]);
  const [myResumen, setMyResumen] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user's vacation summary
        if (!isPending) {
          const resumenRes = await axios.get(`${API}/my-vacaciones/resumen`);
          setMyResumen(resumenRes.data);
        }

        // Admin-only data
        if (isAdmin) {
          const [statsRes, budgetsRes, pendingRes] = await Promise.all([
            axios.get(`${API}/dashboard/stats`),
            axios.get(`${API}/budget-templates`),
            axios.get(`${API}/admin/users/pending`)
          ]);
          setStats(statsRes.data);
          setRecentBudgets(budgetsRes.data.slice(0, 5));
          setPendingUsers(pendingRes.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, isPending]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div data-testid="home-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">
          Hola, {user?.name?.split(' ')[0] || 'Usuario'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isPending ? 'Tu cuenta está pendiente de aprobación' : 'Resumen de tu actividad'}
        </p>
      </div>

      {/* Presupuestos Recientes + Acciones Rapidas: prioritario para el admin */}
      {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="border-b border-slate-50 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">Presupuestos Recientes</CardTitle>
                  <Link to="/budgets">
                    <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white shadow-sm px-4" data-testid="view-all-budgets">
                      Ver todos <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {recentBudgets.length === 0 ? (
                  <div className="p-6 text-center text-slate-400" data-testid="no-budgets">
                    No hay presupuestos todavía
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {recentBudgets.map((budget) => (
                      <li key={budget.id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`budget-item-${budget.id}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{budget.budget_number}</p>
                            <p className="text-sm text-slate-500">{budget.cliente}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-medium text-slate-900">{formatCurrency(budget.total_con_iva || 0)}</p>
                            <span className={`status-badge status-${budget.status}`}>
                              {budget.status === 'pending' ? 'Pendiente' : budget.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="border-b border-slate-50 pb-4">
                <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Link to="/budgets/new">
                  <Button variant="outline" className="w-full justify-start h-14 text-left">
                    <FileText className="w-5 h-5 mr-3 text-red-500" />
                    <div>
                      <p className="font-medium">Nuevo Presupuesto</p>
                      <p className="text-xs text-slate-500">Crear presupuesto desde plantilla</p>
                    </div>
                  </Button>
                </Link>
                <Link to="/calendar">
                  <Button variant="outline" className="w-full justify-start h-14 text-left">
                    <Calendar className="w-5 h-5 mr-3 text-red-500" />
                    <div>
                      <p className="font-medium">Ver Calendarios</p>
                      <p className="text-xs text-slate-500">Gestionar vacaciones de todos</p>
                    </div>
                  </Button>
                </Link>
                <Link to="/clients">
                  <Button variant="outline" className="w-full justify-start h-14 text-left">
                    <Building2 className="w-5 h-5 mr-3 text-sky-500" />
                    <div>
                      <p className="font-medium">Clientes</p>
                      <p className="text-xs text-slate-500">Fichas, fotos, partes e incidencias</p>
                    </div>
                  </Button>
                </Link>
                <Link to="/admin/users">
                  <Button variant="outline" className="w-full justify-start h-14 text-left">
                    <Users className="w-5 h-5 mr-3 text-purple-500" />
                    <div>
                      <p className="font-medium">Gestionar Usuarios</p>
                      <p className="text-xs text-slate-500">Aprobar y configurar accesos</p>
                    </div>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
)}

      {/* Foto rapida: sesion de captura multiple + mini clasificacion opcional */}
      {!isPending && <FotoRapidaFlow />}
      {!isPending && <ParteRapidoFlow />}
      {!isPending && <SolicitudRopaFlow />}

      {isAdmin && <FotosPendientesAviso />}

      {/* Pending Approval Notice */}
      {isPending && (
        <Card className="border-orange-200 bg-orange-50 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-orange-900">Cuenta pendiente de aprobación</p>
                <p className="text-sm text-orange-700">Un administrador revisará tu solicitud pronto.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acceso rapido a Mi Calendario: ahora va primero, antes de los dias disponibles */}
      {!isPending && myResumen && (
        <div className="mb-6">
          <Link to="/my-calendar">
            <Card className="border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Acceso rápido</p>
                    <p className="text-xl font-bold text-slate-900">Mi Calendario</p>
                    <p className="text-sm text-slate-500 mt-1">Gestiona tus vacaciones y días libres</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Dias disponibles de vacaciones y libres */}
      {!isPending && myResumen && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        >
          <motion.div variants={item}>
            <Card className="border-orange-200 bg-orange-50 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700">Vacaciones</p>
                    <p className="text-2xl font-bold text-orange-900 font-['JetBrains_Mono']">
                      {myResumen.dias_disfrutados}/{myResumen.dias_disponibles}
                    </p>
                    <p className="text-xs text-orange-600">{myResumen.dias_restantes} restantes</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Palmtree className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="border-blue-200 bg-blue-50 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-700">Días Libres</p>
                    <p className="text-2xl font-bold text-blue-900 font-['JetBrains_Mono']">
                      {myResumen.dias_libres_disfrutados}/{myResumen.dias_libres_disponibles}
                    </p>
                    <p className="text-xs text-blue-600">{myResumen.dias_libres_restantes} restantes</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Sun className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Admin Section */}
      {isAdmin && (
        <>
          {/* Pending Users Alert */}
          {pendingUsers.length > 0 && (
            <Card className="border-orange-200 bg-orange-50 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-orange-600" />
                    <span className="text-orange-900 font-medium">
                      {pendingUsers.length} usuario{pendingUsers.length > 1 ? 's' : ''} pendiente{pendingUsers.length > 1 ? 's' : ''} de aprobación
                    </span>
                  </div>
                  <Link to="/admin/users">
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                      Revisar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Stats */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <motion.div variants={item}>
              <Card className="border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Presupuestos</p>
                      <p className="text-2xl font-bold text-slate-900 font-['JetBrains_Mono']" data-testid="total-budgets">
                        {stats?.total_budgets || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <Card className="border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Pendientes</p>
                      <p className="text-2xl font-bold text-orange-600 font-['JetBrains_Mono']" data-testid="pending-budgets">
                        {stats?.pending_budgets || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <Card className="border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Aprobados (sin IVA)</p>
                      <p className="text-2xl font-bold text-green-600 font-['JetBrains_Mono']" data-testid="approved-amount">
                        {formatCurrency(stats?.total_approved_amount || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <Link to="/admin/users">
                <Card className="border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Gestión</p>
                        <p className="text-xl font-bold text-slate-900">Usuarios</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                        <Users className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </motion.div>

        </>
      )}
    </div>
  );
};

export default HomePage;
