import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Calendar, Clock, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";

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
  const [stats, setStats] = useState(null);
  const [recentBudgets, setRecentBudgets] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, budgetsRes, eventsRes] = await Promise.all([
          axios.get(`${API}/dashboard/stats`),
          axios.get(`${API}/budget-templates`),
          axios.get(`${API}/events`)
        ]);
        setStats(statsRes.data);
        setRecentBudgets(budgetsRes.data.slice(0, 5));
        
        const today = new Date().toISOString().split('T')[0];
        const upcoming = eventsRes.data
          .filter(e => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);
        setUpcomingEvents(upcoming);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
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
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">Bienvenido</h1>
        <p className="text-slate-500 mt-1">Resumen de tu actividad</p>
      </div>

      {/* Stats Cards */}
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
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-600" />
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
          <Card className="border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Próximos Eventos</p>
                  <p className="text-2xl font-bold text-slate-900 font-['JetBrains_Mono']" data-testid="upcoming-events">
                    {stats?.upcoming_events || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Budgets */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">Presupuestos Recientes</CardTitle>
              <Link to="/budgets">
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700" data-testid="view-all-budgets">
                  Ver todos <ArrowRight className="w-4 h-4 ml-1" />
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

        {/* Upcoming Events */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">Próximos Eventos</CardTitle>
              <Link to="/calendar">
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700" data-testid="view-calendar">
                  Ver calendario <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingEvents.length === 0 ? (
              <div className="p-6 text-center text-slate-400" data-testid="no-events">
                No hay eventos próximos
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingEvents.map((event) => (
                  <li key={event.id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`event-item-${event.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-indigo-50 flex flex-col items-center justify-center">
                        <span className="text-xs text-indigo-600 uppercase font-medium">
                          {new Date(event.date).toLocaleDateString('es-ES', { month: 'short' })}
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          {new Date(event.date).getDate()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{event.title}</p>
                        {event.start_time && (
                          <p className="text-sm text-slate-500">
                            {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HomePage;
