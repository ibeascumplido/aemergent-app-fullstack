import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Search,
  ArrowLeft,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Limite blando del "top 10" - se avisa si se pasa, no se bloquea
const TOP10_SOFT_LIMIT = 10;

const emptyForm = { nombre: "", en_top10: false, orden: 100 };

const WorkTasksAdminPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialogo crear/editar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Confirmar borrado
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/work-tasks`);
      setTasks(res.data);
    } catch (err) {
      console.error("Error cargando tareas:", err);
      toast.error("Error al cargar el catalogo de tareas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const top10 = tasks.filter((t) => t.en_top10);
  const filtered = tasks.filter((t) =>
    t.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (task) => {
    setEditingId(task.id);
    setForm({
      nombre: task.nombre,
      en_top10: task.en_top10,
      orden: task.orden,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const nombre = form.nombre.trim();
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await axios.patch(`${API}/work-tasks/${editingId}`, {
          nombre,
          en_top10: form.en_top10,
          orden: Number(form.orden) || 100,
        });
        toast.success("Tarea actualizada");
      } else {
        await axios.post(`${API}/work-tasks`, {
          nombre,
          en_top10: form.en_top10,
          orden: Number(form.orden) || 100,
        });
        toast.success("Tarea creada");
      }
      setDialogOpen(false);
      await fetchTasks();
    } catch (err) {
      console.error("Error guardando tarea:", err);
      const status = err?.response?.status;
      if (status === 409) toast.error("Ya existe una tarea con ese nombre");
      else if (status === 400) toast.error(err.response.data?.detail || "Datos invalidos");
      else if (status === 403) toast.error("No tienes permisos para editar el catalogo");
      else toast.error("Error al guardar la tarea");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/work-tasks/${deleteTarget.id}`);
      toast.success("Tarea eliminada");
      setDeleteTarget(null);
      await fetchTasks();
    } catch (err) {
      console.error("Error eliminando tarea:", err);
      toast.error("Error al eliminar la tarea");
    } finally {
      setDeleting(false);
    }
  };

  // Toggle rapido del top10 sin abrir dialogo
  const toggleTop10 = async (task) => {
    const nextValue = !task.en_top10;
    if (nextValue && top10.length >= TOP10_SOFT_LIMIT) {
      toast.warning(
        `Ya tienes ${TOP10_SOFT_LIMIT} tareas en el top ${TOP10_SOFT_LIMIT}. Considera quitar otra antes.`
      );
    }
    try {
      await axios.patch(`${API}/work-tasks/${task.id}`, { en_top10: nextValue });
      await fetchTasks();
    } catch (err) {
      toast.error("No se pudo actualizar");
    }
  };

  return (
    <div data-testid="work-tasks-admin-page">
      {/* Cabecera */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-2 text-slate-600 hover:text-slate-900 -ml-3"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Catalogo de tareas
          </h1>
          <p className="text-slate-500 mt-1">
            {tasks.length} tarea{tasks.length === 1 ? "" : "s"} · {top10.length} en el top{" "}
            {TOP10_SOFT_LIMIT} (checkbox rapido en el parte)
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          data-testid="create-task-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva tarea
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar tarea..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 border-slate-200"
          data-testid="search-tasks"
        />
      </div>

      {/* Lista */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400" data-testid="no-tasks">
              {tasks.length === 0
                ? "No hay tareas en el catalogo"
                : "Ninguna tarea coincide con la busqueda"}
            </div>
          ) : (
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="divide-y divide-slate-100"
            >
              {filtered.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  data-testid={`task-row-${t.id}`}
                >
                  {/* Toggle top10 */}
                  <button
                    type="button"
                    onClick={() => toggleTop10(t)}
                    className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      t.en_top10
                        ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                    title={t.en_top10 ? "Quitar del top 10" : "Añadir al top 10"}
                    data-testid={`toggle-top10-${t.id}`}
                  >
                    <Star
                      className="w-5 h-5"
                      fill={t.en_top10 ? "currentColor" : "none"}
                    />
                  </button>

                  {/* Nombre */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{t.nombre}</p>
                    <p className="text-xs text-slate-400">
                      Orden: {t.orden}
                      {t.uso_count > 0 && ` · usada ${t.uso_count} veces`}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-slate-100"
                      onClick={() => openEdit(t)}
                      data-testid={`edit-task-${t.id}`}
                    >
                      <Pencil className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-red-50"
                      onClick={() => setDeleteTarget(t)}
                      data-testid={`delete-task-${t.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </li>
              ))}
            </motion.ul>
          )}
        </CardContent>
      </Card>

      {/* Info legal / ayuda */}
      <div className="mt-6 text-xs text-slate-500 max-w-2xl">
        <p className="mb-1 font-medium text-slate-600">Consejos rapidos</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>
            La <span className="text-amber-600">estrella</span> marca las tareas del top{" "}
            {TOP10_SOFT_LIMIT}: son las que apareceran como checkbox rapido en el parte
            de trabajo. El resto se pueden buscar/anadir.
          </li>
          <li>
            El campo <span className="font-mono text-slate-600">orden</span> ordena la
            lista de menor a mayor. Deja 100 para las nuevas y usa numeros menores para
            las prioritarias.
          </li>
          <li>Borrar una tarea la desactiva pero conserva su historial en partes ya cerrados.</li>
        </ul>
      </div>

      {/* Dialogo crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="task-form-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-nombre">Nombre</Label>
              <Input
                id="task-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Escarificado"
                data-testid="task-nombre-input"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, en_top10: !f.en_top10 }))
                }
                className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  form.en_top10
                    ? "bg-amber-100 text-amber-600"
                    : "bg-slate-100 text-slate-400"
                }`}
                data-testid="task-top10-toggle"
              >
                <Star
                  className="w-5 h-5"
                  fill={form.en_top10 ? "currentColor" : "none"}
                />
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {form.en_top10 ? "En el top 10 (checkbox rapido)" : "Fuera del top 10 (buscador)"}
                </p>
                <p className="text-xs text-slate-500">
                  Pulsa la estrella para cambiar
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-orden">Orden</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      orden: Math.max(0, (Number(f.orden) || 0) - 10),
                    }))
                  }
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                  title="Subir prioridad"
                >
                  <ChevronsUp className="w-4 h-4" />
                </button>
                <Input
                  id="task-orden"
                  type="number"
                  value={form.orden}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, orden: e.target.value }))
                  }
                  className="text-center"
                  data-testid="task-orden-input"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      orden: (Number(f.orden) || 0) + 10,
                    }))
                  }
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                  title="Bajar prioridad"
                >
                  <ChevronsDown className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Numero menor = mas arriba en la lista
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="task-save-btn"
            >
              {saving ? "Guardando..." : editingId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent data-testid="delete-task-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-semibold">{deleteTarget?.nombre}</span>.
              La tarea deja de aparecer en el catalogo pero se conserva en los partes
              historicos donde ya se uso (soft delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-task-btn"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkTasksAdminPage;
