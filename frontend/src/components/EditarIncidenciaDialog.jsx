import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Camera, Images, X } from "lucide-react";
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
import { comprimirImagen } from "@/lib/imagen";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Edición (solo admin) de una incidencia: título, descripción y fotos
 * (añadir con cámara o galería / quitar las existentes).
 */
const EditarIncidenciaDialog = ({ incidencia, onClose, onSaved }) => {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotosActuales, setFotosActuales] = useState([]);
  const [quitar, setQuitar] = useState([]);
  const [nuevas, setNuevas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (incidencia) {
      setTitulo(incidencia.titulo || "");
      setDescripcion(incidencia.descripcion || "");
      setFotosActuales(incidencia.fotos || []);
      setQuitar([]);
      setNuevas([]);
    }
  }, [incidencia]);

  const onElegir = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (files.length === 0) return;
    try {
      const datos = await Promise.all(files.map((f) => comprimirImagen(f)));
      setNuevas((prev) => [...prev, ...datos].slice(0, 10));
    } catch {
      toast.error("No se pudo leer la foto");
    }
  };

  const guardar = async () => {
    if (!titulo.trim()) {
      toast.error("Escribe el título");
      return;
    }
    setGuardando(true);
    try {
      await axios.put(`${API}/incidencias/${incidencia.id}`, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        quitar_fotos: quitar.length > 0 ? quitar : undefined,
        fotos_nuevas: nuevas.length > 0 ? nuevas : undefined,
      });
      toast.success("Incidencia actualizada");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Error editando incidencia:", err);
      toast.error(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const visibles = fotosActuales.filter((f) => !quitar.includes(f.id));

  return (
    <Dialog open={!!incidencia} onOpenChange={(v) => !v && !guardando && onClose()}>
      <DialogContent className="max-w-sm max-h-[85dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-0 shrink-0">
          <DialogTitle>Editar incidencia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 p-5 overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Fotos</Label>
            {(visibles.length > 0 || nuevas.length > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {visibles.map((f) => (
                  <div key={f.id} className="relative">
                    <img src={f.url} alt="" className="w-14 h-14 rounded-md object-cover border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => setQuitar((prev) => [...prev, f.id])}
                      className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {nuevas.map((src, idx) => (
                  <div key={`n${idx}`} className="relative">
                    <img src={src} alt="" className="w-14 h-14 rounded-md object-cover border-2 border-indigo-300" />
                    <button
                      type="button"
                      onClick={() => setNuevas((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                <Camera className="w-4 h-4" />
                Hacer foto
                <input type="file" accept="image/*" capture="environment" onChange={onElegir} className="hidden" />
              </label>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                <Images className="w-4 h-4" />
                Galería
                <input type="file" accept="image/*" multiple onChange={onElegir} className="hidden" />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter className="p-5 pt-0 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            data-testid="guardar-edicion-incidencia-btn"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditarIncidenciaDialog;
