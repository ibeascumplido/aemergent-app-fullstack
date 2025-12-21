import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusLabels = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const BudgetsPage = () => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    client_name: "",
    amount: "",
    description: "",
    status: "pending",
  });

  const fetchBudgets = async () => {
    try {
      const params = statusFilter !== "all" ? { status: statusFilter } : {};
      const response = await axios.get(`${API}/budgets`, { params });
      setBudgets(response.data);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      toast.error("Error al cargar los presupuestos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [statusFilter]);

  const handleOpenDialog = (budget = null) => {
    if (budget) {
      setSelectedBudget(budget);
      setFormData({
        title: budget.title,
        client_name: budget.client_name,
        amount: budget.amount.toString(),
        description: budget.description || "",
        status: budget.status,
      });
    } else {
      setSelectedBudget(null);
      setFormData({
        title: "",
        client_name: "",
        amount: "",
        description: "",
        status: "pending",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
      };

      if (selectedBudget) {
        await axios.put(`${API}/budgets/${selectedBudget.id}`, payload);
        toast.success("Presupuesto actualizado correctamente");
      } else {
        await axios.post(`${API}/budgets`, payload);
        toast.success("Presupuesto creado correctamente");
      }
      setIsDialogOpen(false);
      fetchBudgets();
    } catch (error) {
      console.error("Error saving budget:", error);
      toast.error("Error al guardar el presupuesto");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/budgets/${selectedBudget.id}`);
      toast.success("Presupuesto eliminado correctamente");
      setIsDeleteDialogOpen(false);
      setSelectedBudget(null);
      fetchBudgets();
    } catch (error) {
      console.error("Error deleting budget:", error);
      toast.error("Error al eliminar el presupuesto");
    }
  };

  const filteredBudgets = budgets.filter(
    (budget) =>
      budget.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div data-testid="budgets-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Presupuestos
          </h1>
          <p className="text-slate-500 mt-1">Gestiona todos tus presupuestos</p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          data-testid="create-budget-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Presupuesto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por título o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-200"
            data-testid="search-input"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="border-slate-200" data-testid="filter-dropdown">
              <Filter className="w-4 h-4 mr-2" />
              {statusFilter === "all" ? "Todos" : statusLabels[statusFilter]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatusFilter("all")} data-testid="filter-all">
              Todos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("pending")} data-testid="filter-pending">
              Pendientes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("approved")} data-testid="filter-approved">
              Aprobados
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("rejected")} data-testid="filter-rejected">
              Rechazados
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Budgets Table */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-400" data-testid="loading">
              Cargando...
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="p-8 text-center text-slate-400" data-testid="no-budgets">
              No hay presupuestos que mostrar
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Título
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBudgets.map((budget) => (
                    <motion.tr
                      key={budget.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-50 transition-colors"
                      data-testid={`budget-row-${budget.id}`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{budget.title}</p>
                          {budget.description && (
                            <p className="text-sm text-slate-500 truncate max-w-xs">
                              {budget.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{budget.client_name}</td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">
                        {formatCurrency(budget.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`status-badge status-${budget.status}`}>
                          {statusLabels[budget.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {formatDate(budget.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(budget)}
                            className="text-slate-600 hover:text-slate-900"
                            data-testid={`edit-budget-${budget.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBudget(budget);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-budget-${budget.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="budget-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">
              {selectedBudget ? "Editar Presupuesto" : "Nuevo Presupuesto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nombre del presupuesto"
                required
                data-testid="budget-title-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Cliente</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Nombre del cliente"
                required
                data-testid="budget-client-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Importe (EUR)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
                data-testid="budget-amount-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger data-testid="budget-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del presupuesto..."
                rows={3}
                data-testid="budget-description-input"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                data-testid="cancel-budget-btn"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="save-budget-btn"
              >
                {selectedBudget ? "Guardar Cambios" : "Crear Presupuesto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el presupuesto
              "{selectedBudget?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-btn"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BudgetsPage;
