import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import BudgetsPage from "@/pages/BudgetsPage";
import BudgetTemplatePage from "@/pages/BudgetTemplatePage";
import AdminCalendarPage from "@/pages/AdminCalendarPage";
import PlanificacionPage from "@/pages/PlanificacionPage";
import FotosPorClasificarPage from "@/pages/FotosPorClasificarPage";
import MyCalendarPage from "@/pages/MyCalendarPage";
import MisFotosPage from "@/pages/MisFotosPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import ClientsPage from "@/pages/ClientsPage";
import WorkTasksAdminPage from "@/pages/WorkTasksAdminPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import ClientLocationsPage from "@/pages/ClientLocationsPage";
import ClientLocationsCalendarPage from "@/pages/ClientLocationsCalendarPage";
import WorkOrderDetailPage from "@/pages/WorkOrderDetailPage";
import RejillaZonasPage from "@/pages/RejillaZonasPage";
import PublicSignPage from "@/pages/PublicSignPage";
import LoginPage from "@/components/auth/LoginPage";
import AuthCallback from "@/components/auth/AuthCallback";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/firmar/:token" element={<PublicSignPage />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<HomePage />} />
              <Route path="my-calendar" element={<MyCalendarPage />} />
              <Route path="mis-fotos" element={<MisFotosPage />} />
              <Route path="planificacion" element={<PlanificacionPage />} />
              
              {/* Admin only routes */}
              <Route path="budgets" element={
                <ProtectedRoute requireBudgets>
                  <BudgetsPage />
                </ProtectedRoute>
              } />
              <Route path="budgets/new" element={
                <ProtectedRoute requireBudgets>
                  <BudgetTemplatePage />
                </ProtectedRoute>
              } />
              <Route path="budgets/:id" element={
                <ProtectedRoute requireBudgets>
                  <BudgetTemplatePage />
                </ProtectedRoute>
              } />
              <Route path="calendar" element={
                <ProtectedRoute requireAdmin>
                  <AdminCalendarPage />
                </ProtectedRoute>
              } />
              <Route path="fotos-por-clasificar" element={
                <ProtectedRoute requireAdmin>
                  <FotosPorClasificarPage />
                </ProtectedRoute>
              } />
              <Route path="admin/users" element={
                <ProtectedRoute requireAdmin>
                  <AdminUsersPage />
                </ProtectedRoute>
              } />
              <Route path="clients/:id" element={
                <ProtectedRoute requireBudgets>
                  <ClientDetailPage />
                </ProtectedRoute>
              } />
              <Route path="clients/:slug/locations" element={
                <ProtectedRoute requireBudgets>
                  <ClientLocationsPage />
                </ProtectedRoute>
              } />
              <Route path="clients/:slug/locations/calendar" element={
                <ProtectedRoute requireBudgets>
                  <ClientLocationsCalendarPage />
                </ProtectedRoute>
              } />
              <Route path="clients" element={
                <ProtectedRoute requireBudgets>
                  <ClientsPage />
                </ProtectedRoute>
              } />
              <Route path="admin/work-tasks" element={
                <ProtectedRoute requireBudgets>
                  <WorkTasksAdminPage />
                </ProtectedRoute>
              } />
              <Route path="work-orders/:id" element={
                <ProtectedRoute requireBudgets>
                  <WorkOrderDetailPage />
                </ProtectedRoute>
              } />
              <Route path="work-orders/:id/rejilla" element={
                <ProtectedRoute requireBudgets>
                  <RejillaZonasPage />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AuthProvider>
    </div>
  );
}

export default App;
