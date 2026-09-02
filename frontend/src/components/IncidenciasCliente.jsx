import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AlertTriangle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/**
 * Incidencias por cliente (Fase 16): problemas/avisos abiertos. Pensado
 * para en el futuro conectarse con el correo (cualquier email
 * referenciado a este cliente se archivaria aqui automaticamente).
 */
const IncidenciasCliente = ({ clientId, centroId }) => {
  const { isAdmin } = useAuth();
  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verCerradas, setVerCerradas] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const cargar = async () => {
    try {
      const params = { client_id: clientId };
      if (centroId) params.centro_id = centroId;
      const res = await axios.get(`${API}/incidencias`, { params });
      setIncidencias(res.data);
    } catch (err) {
      console.error("Error cargando incidencias:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, centroId]);

  const abrirNueva = () => {
    setTitulo("");
    setDescripcion("");
    setDialogOpen(true);
  };

  const crear = async () => {
    if (!titulo.trim()) {
      toast.error("Escribe el título");
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`${API}/incidencias`, {
        client_id: clientId,
        centro_id: centroId || null,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
      });
      toast.success("Incidencia registrada");
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error creando incidencia:", err);
      toast.error("No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = async (id) => {
    try {
      await axios.put(`${API}/incidencias/${id}/cerrar`);
      toast.success("Incidencia cerrada");
      await cargar();
    } catch (err) {
      console.error("Error cerrando incidencia:", err);
      toast.error("No se pudo cerrar");
    }
  };

  const reabrir = async (id) => {
    try {
      await axios.put(`${API}/incidencias/${id}/reabrir`);
      toast.success("Reabierta");
      await cargar();
    } catch (err) {
      console.error("Error reabriendo incidencia:", err);
      toast.error("No se pudo reabrir");
    }
  };

  const eliminar = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/incidencias/${aBorrar.id}`);
      toast.success("Incidencia eliminada");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando incidencia:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading) return null;

  const abiertas = incidencias.filter((i) => i.estado === "abierta");
  const cerradas = incidencias.filter((i) => i.estado === "cerrada");
  const visibles = verCerradas ? [...abiertas, ...cerradas] : abiertas;

  return (
    <div data-testid="incidencias-cliente">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          Incidencias ({abiertas.length} abiertas)
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVerCerradas((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {verCerradas ? "Ocultar cerradas" : "Ver cerradas"}
          </button>
          <Button size="sm" variant="outline" onClick={abrirNueva} data-testid="nueva-incidencia-btn">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nueva incidencia
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Próximamente: cualquier email referenciado a este cliente se archivará aquí
        automáticamente.
      </p>

      {visibles.length === 0 ? (
        <p className="text-sm text-slate-400">Sin incidencias abiertas.</p>
      ) : (
        <div className="space-y-2">
          {visibles.map((i) => (
            <div
              key={i.id}
              className={`px-4 py-3 rounded-lg border ${
                i.estado === "abierta"
                  ? "border-orange-200 bg-orange-50/50"
                  : "border-slate-100 bg-slate-50/50"
              }`}
              data-testid={`incidencia-${i.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      i.estado === "cerrada" ? "text-slate-400 line-through" : "text-slate-800"
                    }`}
                  >
                    {i.titulo}
                  </p>
                  {i.descripcion && (
                    <p className="text-xs text-slate-500 mt-0.5">{i.descripcion}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {i.estado === "abierta"
                      ? `Abierta por ${i.creado_por_nombre} · ${new Date(i.creado_en).toLocaleDateString("es-ES")}`
                      : `Cerrada por ${i.cerrado_por_nombre} · ${new Date(i.cerrado_en).toLocaleDateString("es-ES")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {i.estado === "abierta" ? (
                    <Button size="sm" variant="outline" onClick={() => cerrar(i.id)}>
                      Cerrar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => reabrir(i.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Reabrir
                    </Button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setABorrar(i)}
                      className="text-slate-300 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Riego roto en zona 2"
                data-testid="titulo-incidencia-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={crear}
              disabled={guardando}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="crear-incidencia-btn"
            >
              {guardando ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta incidencia?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{aBorrar?.titulo}". Esta acción no se puede deshacer.
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

export default IncidenciasCliente;
