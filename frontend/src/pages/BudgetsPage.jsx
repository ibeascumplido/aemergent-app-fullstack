import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ===== Estado del trabajo: etiquetas + colores (como el Excel) =====
const estadoTrabajoConfig = {
  pendiente_ejecutar: { label: "Pendiente ejecutar", className: "bg-orange-100 text-orange-700" },
  ejecutado: { label: "Ejecutado", className: "bg-green-100 text-green-700" },
  facturado: { label: "Facturado", className: "bg-yellow-100 text-yellow-700" },
  enviado: { label: "Enviado", className: "bg-blue-100 text-blue-700" },
  mantenimiento: { label: "Mantenimiento", className: "bg-slate-200 text-slate-700" },
};
const estadoTrabajoOrder = [
  "pendiente_ejecutar",
  "ejecutado",
  "facturado",
  "enviado",
  "mantenimiento",
];

// ===== Pedido/Par: etiquetas + colores =====
const pedidoParConfig = {
  ninguno: { label: "—", className: "text-slate-400" },
  enviado: { label: "Enviado", className: "bg-blue-100 text-blue-700" },
  pendiente: { label: "Pendiente", className: "bg-orange-100 text-orange-700" },
};
const pedidoParOrder = ["ninguno", "enviado", "pendiente"];

const BudgetsPage = () => {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  // Columnas de facturación (azules) colapsadas por defecto
  const [showFacturacion, setShowFacturacion] = useState(false);

  const fetchBudgets = async () => {
    try {
      const response = await axios.get(`${API}/budget-templates`);
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
  }, []);

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/budget-templates/${selectedBudget.id}`);
      toast.success("Presupuesto eliminado correctamente");
      setIsDeleteDialogOpen(false);
      setSelectedBudget(null);
      fetchBudgets();
    } catch (error) {
      console.error("Error deleting budget:", error);
      toast.error("Error al eliminar el presupuesto");
    }
  };

  // Actualiza un campo simple del presupuesto (estado, pedido/par, facturado)
  const patchBudget = async (budgetId, payload, okMsg) => {
    try {
      await axios.put(`${API}/budget-templates/${budgetId}`, payload);
      if (okMsg) toast.success(okMsg);
      fetchBudgets();
    } catch (error) {
      console.error("Error updating budget:", error);
      toast.error("Error al actualizar");
    }
  };

  const filteredBudgets = budgets.filter((b) => {
    const q = searchTerm.toLowerCase();
    return (
      b.cliente?.toLowerCase().includes(q) ||
      b.budget_number?.toLowerCase().includes(q) ||
      b.titulo?.toLowerCase().includes(q) ||
      b.centro?.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
      amount || 0
    );

  // Total facturado = suma de Venta (Base Imponible) = total_base
  const totalFacturado = filteredBudgets.reduce(
    (acc, b) => acc + (Number(b.total_base) || 0),
    0
  );

  const th =
    "px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap";
  const thBlue =
    "px-4 py-3 text-left text-xs font-semibold text-sky-700 uppercase tracking-wider whitespace-nowrap bg-sky-50";
  const td = "px-4 py-3 text-sm text-slate-700 whitespace-nowrap";
  const tdBlue = "px-4 py-3 text-sm text-slate-700 whitespace-nowrap bg-sky-50/60";

  return (
    <div data-testid="budgets-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Control de Trabajos
          </h1>
          <p className="text-slate-500 mt-1">
            Vista global de presupuestos y trabajos
          </p>
        </div>
        <Button
          onClick={() => navigate("/budgets/new")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          data-testid="create-budget-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Presupuesto
        </Button>
      </div>

      {/* Barra superior: búsqueda + toggle facturación */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nº, cliente, centro o título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-200"
            data-testid="search-input"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFacturacion((v) => !v)}
          className="border-sky-200 text-sky-700 hover:bg-sky-50"
          data-testid="toggle-facturacion"
        >
          {showFacturacion ? (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Ocultar Facturación
            </>
          ) : (
            <>
              <ChevronRight className="w-4 h-4 mr-2" />
              Mostrar Facturación
            </>
          )}
        </Button>
      </div>

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
                    <th className={`${th} text-left`}>Acciones</th>
                    {/* ===== Columnas blancas (Jardinería) ===== */}
                    <th className={th}>Año</th>
                    <th className={th}>Nº</th>
                    <th className={th}>Nº Presup.</th>
                    <th className={th}>Estado</th>
                    <th className={th}>Fecha Ejec.</th>
                    <th className={th}>Cliente</th>
                    <th className={th}>Centro</th>
                    <th className={th}>Solicitud</th>
                    <th className={th}>Título</th>
                    <th className={th}>Venta (B.I.)</th>
                    {/* ===== Columnas azules (Facturación) ===== */}
                    {showFacturacion && (
                      <>
                        <th className={thBlue}>Pedido Cliente</th>
                        <th className={thBlue}>Factura Inicio</th>
                        <th className={thBlue}>Factura Prov.</th>
                        <th className={thBlue}>Importe Prov.</th>
                        <th className={thBlue}>Facturación</th>
                        <th className={thBlue}>Pedido/Par</th>
                        <th className={thBlue}>Anotaciones Fact.</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBudgets.map((b) => {
                    const est =
                      estadoTrabajoConfig[b.estado_trabajo] ||
                      estadoTrabajoConfig.pendiente_ejecutar;
                    const par =
                      pedidoParConfig[b.pedido_par] || pedidoParConfig.ninguno;
                    return (
                      <motion.tr
                        key={b.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-50 transition-colors"
                        data-testid={`budget-row-${b.id}`}
                      >
                        {/* Acciones (izquierda) */}
                        <td className={td}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/budgets/${b.id}`)}
                              className="text-slate-600 hover:text-slate-900"
                              data-testid={`view-budget-${b.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/budgets/${b.id}`)}
                              className="text-slate-600 hover:text-slate-900"
                              data-testid={`edit-budget-${b.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBudget(b);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              data-testid={`delete-budget-${b.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                        <td className={td}>{b.anio || "-"}</td>
                        <td className={td}>{b.num_orden || "-"}</td>
                        <td className={`${td} font-mono font-medium text-indigo-600`}>
                          {b.budget_number}
                        </td>
                        {/* Estado: desplegable con colores */}
                        <td className={td}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${est.className}`}
                                data-testid={`estado-${b.id}`}
                              >
                                {est.label}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {estadoTrabajoOrder.map((key) => (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() =>
                                    patchBudget(
                                      b.id,
                                      { estado_trabajo: key },
                                      "Estado actualizado"
                                    )
                                  }
                                >
                                  {estadoTrabajoConfig[key].label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className={td}>{b.fecha_ejecucion || "-"}</td>
                        <td className={`${td} font-medium text-slate-900`}>
                          {b.cliente}
                        </td>
                        <td className={td}>{b.centro || b.lugar_ejecucion || "-"}</td>
                        <td className={td}>{b.solicitud_trabajo || "-"}</td>
                        <td className={`${td} max-w-xs truncate`} title={b.titulo}>
                          {b.titulo || b.servicios_descripcion || "-"}
                        </td>
                        <td className={`${td} font-mono font-medium text-slate-900`}>
                          {formatCurrency(b.total_base)}
                        </td>

                        {/* ===== Columnas azules ===== */}
                        {showFacturacion && (
                          <>
                            <td className={tdBlue}>{b.pedido_cliente || "-"}</td>
                            <td className={tdBlue}>{b.factura_inicio || "-"}</td>
                            <td className={tdBlue}>{b.factura_proveedor || "-"}</td>
                            <td className={`${tdBlue} font-mono`}>
                              {b.importe_proveedor
                                ? formatCurrency(b.importe_proveedor)
                                : "-"}
                            </td>
                            {/* Facturación Sí/No toggle */}
                            <td className={tdBlue}>
                              <button
                                onClick={() =>
                                  patchBudget(
                                    b.id,
                                    { facturado: !b.facturado },
                                    "Facturación actualizada"
                                  )
                                }
                                className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${
                                  b.facturado
                                    ? "bg-green-100 text-green-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                                data-testid={`facturado-${b.id}`}
                              >
                                {b.facturado ? "Sí" : "No"}
                              </button>
                            </td>
                            {/* Pedido/Par desplegable */}
                            <td className={tdBlue}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${par.className}`}
                                    data-testid={`pedidopar-${b.id}`}
                                  >
                                    {par.label}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {pedidoParOrder.map((key) => (
                                    <DropdownMenuItem
                                      key={key}
                                      onClick={() =>
                                        patchBudget(
                                          b.id,
                                          { pedido_par: key },
                                          "Pedido actualizado"
                                        )
                                      }
                                    >
                                      {pedidoParConfig[key].label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                            <td
                              className={`${tdBlue} max-w-xs truncate`}
                              title={b.anotaciones_facturacion}
                            >
                              {b.anotaciones_facturacion || "-"}
                            </td>
                          </>
                        )}

                      </motion.tr>
                    );
                  })}
                </tbody>
                {/* Fila TOTAL FACTURADO */}
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td />
                    <td
                      className="px-4 py-4 text-sm font-bold text-slate-900 text-right"
                      colSpan={9}
                    >
                      TOTAL FACTURADO
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-900 font-mono">
                      {formatCurrency(totalFacturado)}
                    </td>
                    {showFacturacion && <td colSpan={7} className="bg-sky-50/60" />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmación de borrado */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              presupuesto "{selectedBudget?.budget_number}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn">
              Cancelar
            </AlertDialogCancel>
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
