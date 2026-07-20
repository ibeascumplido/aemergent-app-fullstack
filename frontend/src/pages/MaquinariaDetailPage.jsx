import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Wrench, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ESTADOS = [
  { value: "operativo", label: "Operativo", badge: "bg-emerald-50 text-emerald-700" },
  { value: "en_reparacion", label: "En reparación", badge: "bg-amber-50 text-amber-700" },
  { value: "fuera_servicio", label: "Fuera de servicio", badge: "bg-red-50 text-red-700" },
];

const TIPOS_HISTORIAL = [
  { value: "averia", label: "Avería", badge: "bg-red-50 text-red-700" },
  { value: "arreglo", label: "Arreglo", badge: "bg-emerald-50 text-emerald-700" },
  { value: "revision", label: "Revisión", badge: "bg-sky-50 text-sky-700" },
];

const tipoInfo = (v) => TIPOS_HISTORIAL.find((t) => t.value === v);
const hoyISO = () => new Date().toISOString().slice(0, 10);

const MaquinariaDetailPage = () => {
  const { maquinariaId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [maquina, setMaquina] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const [nuevoTipo, setNuevoTipo] = useState("averia");
  const [nuevaFecha, setNuevaFecha] = useState(hoyISO());
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [anadiendo, setAnadiendo] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  const [fotoABorrar, setFotoABorrar] = useState(null);

  const cargar = async () => {
    try {
      const [mRes, hRes] = await Promise.all([
        axios.get(`${API}/maquinaria/${maquinariaId}`),
        axios.get(`${API}/maquinaria/${maquinariaId}/historial`),
      ]);
      setMaquina(mRes.data);
      setForm({
        nombre: mRes.data.nombre || "",
        anio_fabricacion: mRes.data.anio_fabricacion || "",
        ubicacion_actual: mRes.data.ubicacion_actual || "",
        estado: mRes.data.estado || "operativo",
        notas: mRes.data.notas || "",
      });
      setHistorial(hRes.data);
    } catch (err) {
      console.error("Error cargando maquinaria:", err);
      toast.error("No se pudo cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maquinariaId]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await axios.put(`${API}/maquinaria/${maquinariaId}`, {
        nombre: form.nombre.trim(),
        anio_fabricacion: form.anio_fabricacion ? Number(form.anio_fabricacion) : null,
        ubicacion_actual: form.ubicacion_actual.trim() || null,
        estado: form.estado,
        notas: form.notas,
      });
      toast.success("Actualizado");
      await cargar();
    } catch (err) {
      console.error("Error guardando:", err);
      toast.error("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const subirFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoFoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await axios.post(`${API}/maquinaria/${maquinariaId}/fotos`, { imagen: reader.result });
        toast.success("Foto añadida");
        await cargar();
      } catch (err) {
        console.error("Error subiendo foto:", err);
        toast.error("No se pudo subir la foto");
      } finally {
        setSubiendoFoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const eliminarFoto = async () => {
    if (fotoABorrar === null) return;
    try {
      await axios.delete(`${API}/maquinaria/${maquinariaId}/fotos/${fotoABorrar}`);
      toast.success("Foto eliminada");
      setFotoABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando foto:", err);
      toast.error("No se pudo eliminar");
    }
  };

  const anadirHistorial = async () => {
    if (!nuevaDescripcion.trim()) {
      toast.error("Describe qué ha pasado");
      return;
    }
    setAnadiendo(true);
    try {
      await axios.post(`${API}/maquinaria/${maquinariaId}/historial`, {
        tipo: nuevoTipo,
        fecha: nuevaFecha,
        descripcion: nuevaDescripcion.trim(),
      });
      toast.success("Registrado");
      setNuevaDescripcion("");
      setNuevaFecha(hoyISO());
      await cargar();
    } catch (err) {
      console.error("Error registrando historial:", err);
      toast.error("No se pudo registrar");
    } finally {
      setAnadiendo(false);
    }
  };

  const eliminarHistorial = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/historial-maquinaria/${aBorrar.id}`);
      toast.success("Eliminado");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando historial:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading || !form) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  if (!maquina) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("/maquinaria")} className="mb-4" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">No se encontró.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="maquinaria-detail-page">
      <Button variant="ghost" onClick={() => navigate("/maquinaria")} className="mb-4 -ml-3" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Maquinaria
      </Button>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Wrench className="w-7 h-7 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            {maquina.nombre}
          </h1>
        </div>
        {estadoInfoBadge(form.estado)}
      </div>

      {/* Galeria de fotos */}
      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Fotos</p>
          <div className="flex flex-wrap gap-2">
            {(maquina.fotos || []).map((url, i) => (
              <div key={i} className="relative group">
                <button
                  type="button"
                  onClick={() => setFotoAmpliada(url)}
                  className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setFotoABorrar(i)}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {isAdmin && (
              <label
                className={`w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                  subiendoFoto ? "border-slate-200 text-slate-300" : "border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
                }`}
              >
                <input type="file" accept="image/*" onChange={subirFoto} disabled={subiendoFoto} className="hidden" />
                <Plus className="w-6 h-6" />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Datos</p>
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              disabled={!isAdmin}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Año de fabricación</Label>
              <Input
                type="number"
                value={form.anio_fabricacion}
                onChange={(e) => setForm((f) => ({ ...f, anio_fabricacion: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}
                disabled={!isAdmin}
              >
                <SelectTrigger data-testid="estado-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ubicación actual</Label>
            <Input
              value={form.ubicacion_actual}
              onChange={(e) => setForm((f) => ({ ...f, ubicacion_actual: e.target.value }))}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              rows={3}
              disabled={!isAdmin}
            />
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Button
          onClick={guardar}
          disabled={guardando}
          className="bg-indigo-600 hover:bg-indigo-700 text-white mb-8"
          data-testid="guardar-maquinaria-btn"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Averías, arreglos y revisiones</h2>

        <div className="flex items-end gap-2 mb-4 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={nuevoTipo} onValueChange={setNuevoTipo}>
              <SelectTrigger className="w-36" data-testid="tipo-historial-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_HISTORIAL.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={nuevaDescripcion}
              onChange={(e) => setNuevaDescripcion(e.target.value)}
              placeholder="Ej. Cambiado el cable de arranque"
              data-testid="nuevo-historial-input"
            />
          </div>
          <Button
            onClick={anadirHistorial}
            disabled={anadiendo}
            className="bg-slate-800 hover:bg-slate-900 text-white"
            data-testid="anadir-historial-btn"
          >
            <Plus className="w-4 h-4 mr-1" />
            Añadir
          </Button>
        </div>

        {historial.length === 0 ? (
          <p className="text-sm text-slate-400">Sin registros todavía.</p>
        ) : (
          <div className="space-y-2">
            {historial.map((h) => {
              const info = tipoInfo(h.tipo);
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100"
                  data-testid={`historial-${h.id}`}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${info?.badge}`}>
                      {info?.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{h.descripcion}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(h.fecha + "T00:00:00").toLocaleDateString("es-ES")}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setABorrar(h)}
                      className="text-red-500 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            className="absolute top-4 right-4 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fotoAmpliada}
            alt=""
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{aBorrar?.descripcion}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarHistorial} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={fotoABorrar !== null} onOpenChange={(open) => !open && setFotoABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarFoto} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function estadoInfoBadge(estado) {
  const info = ESTADOS.find((e) => e.value === estado);
  if (!info) return null;
  return (
    <span className={`ml-auto text-xs font-medium px-3 py-1.5 rounded-full ${info.badge}`}>
      {info.label}
    </span>
  );
}

export default MaquinariaDetailPage;
