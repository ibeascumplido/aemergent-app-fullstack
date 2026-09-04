import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus,
  X,
  Trash2,
  Pencil,
  FileText,
  Image as ImageIcon,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GuiaTrabajo = ({ centroId }) => {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Diálogo de crear/editar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null); // item que se edita, o null si es nuevo
  const [zona, setZona] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState(null); // data-uri
  const [archivoNombre, setArchivoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/centros/${centroId}/guia`);
      setItems(res.data || []);
    } catch (err) {
      console.error("Error cargando guía:", err);
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setZona("");
    setDescripcion("");
    setArchivo(null);
    setArchivoNombre("");
    setDialogOpen(true);
  };

  const abrirEditar = (item) => {
    setEditando(item);
    setZona(item.zona || "");
    setDescripcion(item.descripcion || "");
    setArchivo(null);
    setArchivoNombre("");
    setDialogOpen(true);
  };

  const onArchivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okImg = file.type.startsWith("image/");
    const okPdf = file.type === "application/pdf";
    if (!okImg && !okPdf) {
      toast.error("Sube una imagen o un PDF");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setArchivo(reader.result);
      setArchivoNombre(file.name);
    };
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    if (!editando && !archivo) {
      toast.error("Añade una imagen o un PDF");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await axios.put(`${API}/centros/${centroId}/guia/${editando.id}`, {
          zona,
          descripcion,
        });
        toast.success("Guía actualizada");
      } else {
        await axios.post(`${API}/centros/${centroId}/guia`, {
          zona,
          descripcion,
          archivo,
        });
        toast.success("Añadido a la guía");
      }
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error guardando guía:", err);
      toast.error("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrar = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/centros/${centroId}/guia/${aBorrar.id}`);
      toast.success("Elemento borrado");
      setItems((prev) => prev.filter((x) => x.id !== aBorrar.id));
    } catch (err) {
      console.error("Error borrando:", err);
      toast.error("No se pudo borrar");
    } finally {
      setABorrar(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-6">Cargando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <p className="text-sm text-slate-500">
            Fotos y documentos con instrucciones de cómo trabajar en cada zona
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={abrirNuevo} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="guia-nuevo-btn">
            <Plus className="w-4 h-4 mr-1" />
            Añadir
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400 text-sm">
            Aún no hay guía de trabajo para este centro.
            {isAdmin && " Añade fotos o documentos con instrucciones."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <Card key={item.id} className="border-slate-100 overflow-hidden" data-testid={`guia-item-${item.id}`}>
              <CardContent className="p-0">
                {item.tipo === "pdf" ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {item.zona || "Documento"}
                      </p>
                      <p className="text-xs text-slate-400">PDF · toca para abrir</p>
                    </div>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFotoAmpliada(item.url)}
                    className="w-full block"
                  >
                    <img src={item.url} alt="" className="w-full h-44 object-cover" />
                  </button>
                )}

                <div className="p-3">
                  {item.zona && item.tipo !== "pdf" && (
                    <p className="font-medium text-slate-800">{item.zona}</p>
                  )}
                  {item.descripcion && (
                    <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">
                      {item.descripcion}
                    </p>
                  )}
                  {isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => abrirEditar(item)} className="h-8">
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setABorrar(item)}
                        className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar elemento" : "Añadir a la guía"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editando && (
              <div className="space-y-1.5">
                <Label>Imagen o documento (PDF)</Label>
                {archivo ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200">
                    <ImageIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 truncate flex-1">{archivoNombre}</span>
                    <button type="button" onClick={() => { setArchivo(null); setArchivoNombre(""); }} className="text-slate-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                    <Plus className="w-4 h-4" />
                    Seleccionar archivo
                    <input type="file" accept="image/*,application/pdf" onChange={onArchivo} className="hidden" />
                  </label>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Zona / título</Label>
              <Input
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                placeholder="Ej. Jardinera de la entrada"
                data-testid="guia-zona-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Instrucciones / descripción</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                placeholder="Ej. Regar con poca agua, no tiene drenaje. Podar el seto cada 2 meses."
                data-testid="guia-descripcion-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="guia-guardar-btn">
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!aBorrar} onOpenChange={(v) => !v && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este elemento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará de la guía de trabajo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBorrar} className="bg-red-600 hover:bg-red-700">
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Foto a pantalla completa */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button type="button" onClick={() => setFotoAmpliada(null)} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X className="w-7 h-7" />
          </button>
          <img
            src={fotoAmpliada}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default GuiaTrabajo;
