import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyForm = { nombre: "", direccion: "" };

/**
 * Subgrupo de "centros" dentro de un cliente (Fase 9 parte 5): los sitios
 * concretos donde se trabaja (ej. "IKEA - Alcorcon", "IKEA - Getafe").
 * Version ligera, pensada sobre todo para dar columnas mas precisas en
 * Planificacion de operarios - no lleva los campos de frecuencia/horas
 * de Ubicaciones (eso es especifico del seguimiento de GALP).
 */
const CentrosDeCliente = ({ clientSlug }) => {
  const { isAdmin } = useAuth();
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/clients/${clientSlug}/centros`);
      setCentros(res.data);
    } catch (err) {
      console.error("Error cargando centros:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSlug]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({ nombre: c.nombre, direccion: c.direccion || "" });
    setDialogOpen(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await axios.put(`${API}/centros/${editando.id}`, {
          nombre: form.nombre.trim(),
          direccion: form.direccion.trim() || null,
        });
        toast.success("Centro actualizado");
      } else {
        await axios.post(`${API}/clients/${clientSlug}/centros`, {
          nombre: form.nombre.trim(),
          direccion: form.direccion.trim() || null,
        });
        toast.success("Centro creado");
      }
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error guardando centro:", err);
      toast.error("Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/centros/${aBorrar.id}`);
      toast.success("Centro eliminado");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando centro:", err);
      toast.error("Error al eliminar");
    }
  };

  if (loading) return null;

  return (
    <div className="mb-6" data-testid="centros-de-cliente">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-400" />
          Centros ({centros.length})
        </h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={abrirNuevo} data-testid="nuevo-centro-btn">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nuevo centro
          </Button>
        )}
      </div>

      {centros.length === 0 ? (
        <p className="text-sm text-slate-400">
          Todavía no hay centros definidos para este cliente.
        </p>
      ) : (
        <div className="space-y-1.5">
          {centros.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-100"
              data-testid={`centro-${c.id}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.nombre}</p>
                {c.direccion && (
                  <p className="text-xs text-slate-400 truncate">{c.direccion}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => abrirEditar(c)}
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setABorrar(c)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar centro" : "Nuevo centro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. IKEA - Alcorcón"
                data-testid="nombre-centro-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección (opcional)</Label>
              <Input
                value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="guardar-centro-btn"
            >
              {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear centro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este centro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{aBorrar?.nombre}". Si ya lo usas como columna en Planificación,
              esa columna dejará de resolverse correctamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CentrosDeCliente;
