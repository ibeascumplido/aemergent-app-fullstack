import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ListChecks, Plus, Camera, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import DashboardTileVisual from "@/components/DashboardTileVisual";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRIORIDAD_COLOR = {
  5: "bg-red-100 text-red-700",
  4: "bg-orange-100 text-orange-700",
  3: "bg-amber-100 text-amber-700",
  2: "bg-slate-100 text-slate-600",
  1: "bg-slate-50 text-slate-400",
};

/**
 * Widget del dashboard (Fase 13) para el operario: tareas pendientes de
 * el/los sitio(s) donde esta asignado hoy segun Planificacion. Si no
 * tiene ninguna asignacion hoy, no se muestra nada (no tiene sentido
 * mostrar un widget vacio de "tareas de un sitio" sin sitio).
 */
const TareasHoyWidget = () => {
  const [tareas, setTareas] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("3");
  const [guardando, setGuardando] = useState(false);

  // Proponer en cualquier cliente/centro
  const [clientes, setClientes] = useState([]);
  const [clienteSel, setClienteSel] = useState("");
  const [centros, setCentros] = useState([]);
  const [centroSel, setCentroSel] = useState("");
  const [catalogo, setCatalogo] = useState([]);
  const [tareaCatalogoSel, setTareaCatalogoSel] = useState("libre");
  const [zonaTexto, setZonaTexto] = useState("");
  const [fotoPropuesta, setFotoPropuesta] = useState(null);

  const [dialogFotoTareaId, setDialogFotoTareaId] = useState(null);
  const [fotoDataUrl, setFotoDataUrl] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cargar = async () => {
    try {
      const [tRes, dRes, cRes, catRes] = await Promise.all([
        axios.get(`${API}/tareas-centro/mis-tareas-hoy`),
        axios.get(`${API}/tareas-centro/mis-destinos-hoy`),
        axios.get(`${API}/clients`).catch(() => ({ data: [] })),
        axios.get(`${API}/work-tasks`).catch(() => ({ data: [] })),
      ]);
      setTareas(tRes.data);
      setDestinos(dRes.data);
      setClientes(cRes.data || []);
      setCatalogo(catRes.data || []);
    } catch (err) {
      console.error("Error cargando tareas de hoy:", err);
    } finally {
      setLoading(false);
    }
  };

  // Al elegir un cliente en el formulario de proponer, cargar sus centros.
  const onClienteSel = async (clientId) => {
    setClienteSel(clientId);
    setCentroSel("");
    setCentros([]);
    const cli = clientes.find((c) => c.id === clientId);
    if (!cli?.slug) return;
    try {
      const res = await axios.get(`${API}/clients/${cli.slug}/centros`);
      setCentros(res.data || []);
    } catch (err) {
      console.error("Error cargando centros:", err);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNueva = () => {
    setDescripcion("");
    setPrioridad("3");
    setClienteSel("");
    setCentroSel("");
    setCentros([]);
    setTareaCatalogoSel("libre");
    setZonaTexto("");
    setFotoPropuesta(null);
    setDialogOpen(true);
  };

  const onFotoPropuesta = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sube una imagen");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFotoPropuesta(reader.result);
    reader.readAsDataURL(file);
  };

  const crear = async () => {
    if (!clienteSel) {
      toast.error("Elige un cliente");
      return;
    }
    // Construir la descripción: o bien tarea del catálogo (+ zona), o bien
    // texto libre. La zona/anotación se añade al final entre paréntesis.
    let texto = "";
    if (tareaCatalogoSel && tareaCatalogoSel !== "libre") {
      const t = catalogo.find((x) => x.id === tareaCatalogoSel);
      texto = t ? t.nombre : "";
      if (zonaTexto.trim()) texto += ` (${zonaTexto.trim()})`;
    } else {
      texto = descripcion.trim();
      if (zonaTexto.trim()) texto += ` (${zonaTexto.trim()})`;
    }
    if (!texto) {
      toast.error("Elige una tarea o escríbela");
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`${API}/tareas-centro`, {
        client_id: clienteSel,
        centro_id: centroSel || null,
        descripcion: texto,
        prioridad: Number(prioridad),
        foto: fotoPropuesta || null,
      });
      toast.success("Tarea propuesta. El administrador la revisará.");
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error creando tarea:", err);
      toast.error("No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  const completarSinFoto = async (tareaId) => {
    try {
      await axios.put(`${API}/tareas-centro/${tareaId}/completar`, {});
      toast.success("Tarea completada");
      await cargar();
    } catch (err) {
      console.error("Error completando tarea:", err);
      toast.error("No se pudo completar");
    }
  };

  const onFotoSeleccionada = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFotoDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const confirmarCompletarConFoto = async () => {
    setSubiendoFoto(true);
    try {
      await axios.put(`${API}/tareas-centro/${dialogFotoTareaId}/completar`, {
        foto: fotoDataUrl,
      });
      toast.success("Tarea completada");
      setDialogFotoTareaId(null);
      await cargar();
    } catch (err) {
      console.error("Error completando tarea:", err);
      toast.error("No se pudo completar");
    } finally {
      setSubiendoFoto(false);
    }
  };

  if (loading) return null;

  const numPendientes = tareas.length;
  const subtitulo =
    numPendientes === 0
      ? destinos.length === 0
        ? "Propón una tarea en cualquier centro"
        : "Sin tareas pendientes hoy"
      : `${numPendientes} pendiente${numPendientes === 1 ? "" : "s"} hoy`;

  if (!expandido) {
    return (
      <button
        type="button"
        onClick={() => setExpandido(true)}
        className="flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all p-4"
        data-testid="tarea-hoy-tile"
      >
        <DashboardTileVisual
          icon={ListChecks}
          title="Tareas"
          subtitle={subtitulo}
          color="ambar"
        />
      </button>
    );
  }

  return (
    <Card className="border-slate-100 shadow-sm mb-6" data-testid="tareas-hoy-widget">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-slate-400" />
            Propuesta y ejecución de tareas
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={abrirNueva} data-testid="anadir-tarea-hoy-btn">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Proponer
            </Button>
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5"
              title="Cerrar"
              data-testid="cerrar-tarea-hoy-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {tareas.length === 0 ? (
          <p className="text-sm text-slate-400">
            {destinos.length === 0
              ? "No tienes sitios asignados hoy. Puedes proponer una tarea en cualquier centro con el botón de arriba."
              : "Sin tareas pendientes en tus sitios de hoy. Puedes proponer una nueva."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {tareas.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 px-3 py-2 rounded-lg border border-slate-200"
                data-testid={`tarea-hoy-${t.id}`}
              >
                <button
                  type="button"
                  onClick={() => completarSinFoto(t.id)}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-400 shrink-0"
                  title="Marcar como hecha"
                  data-testid={`check-tarea-hoy-${t.id}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{t.descripcion}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORIDAD_COLOR[t.prioridad]}`}>
                      P{t.prioridad}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {t.centro_nombre || t.client_nombre}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDialogFotoTareaId(t.id);
                    setFotoDataUrl(null);
                  }}
                  className="text-slate-300 hover:text-indigo-500 shrink-0"
                  title="Completar con foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proponer tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clienteSel} onValueChange={onClienteSel}>
                <SelectTrigger data-testid="cliente-tarea-select">
                  <SelectValue placeholder="Elige un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {clienteSel && centros.length > 0 && (
              <div className="space-y-1.5">
                <Label>Centro (opcional)</Label>
                <Select value={centroSel || "ninguno"} onValueChange={(v) => setCentroSel(v === "ninguno" ? "" : v)}>
                  <SelectTrigger data-testid="centro-tarea-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Todo el cliente (sin centro concreto)</SelectItem>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Tarea</Label>
              <Select value={tareaCatalogoSel} onValueChange={setTareaCatalogoSel}>
                <SelectTrigger data-testid="tarea-catalogo-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="libre">Escribirla a mano</SelectItem>
                  {catalogo.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tareaCatalogoSel === "libre" && (
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  placeholder="Ej. Falta agua en el riego"
                  data-testid="descripcion-tarea-hoy-input"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Zona / anotación (opcional)</Label>
              <Textarea
                value={zonaTexto}
                onChange={(e) => setZonaTexto(e.target.value)}
                rows={2}
                placeholder="Ej. junto a los cipreses de la entrada"
                data-testid="zona-tarea-hoy-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Foto (opcional)</Label>
              {fotoPropuesta ? (
                <div className="relative inline-block">
                  <img
                    src={fotoPropuesta}
                    alt=""
                    className="w-24 h-24 rounded-lg object-cover border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setFotoPropuesta(null)}
                    className="absolute -top-2 -right-2 bg-white rounded-full border border-slate-200 p-0.5 text-slate-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                  <Camera className="w-4 h-4" />
                  Añadir foto
                  <input type="file" accept="image/*" onChange={onFotoPropuesta} className="hidden" />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={setPrioridad}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - Máxima</SelectItem>
                  <SelectItem value="4">4 - Alta</SelectItem>
                  <SelectItem value="3">3 - Media</SelectItem>
                  <SelectItem value="2">2 - Baja</SelectItem>
                  <SelectItem value="1">1 - Mínima</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={crear}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="crear-tarea-hoy-btn"
            >
              {guardando ? "Enviando..." : "Proponer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!dialogFotoTareaId}
        onOpenChange={(v) => !subiendoFoto && !v && setDialogFotoTareaId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Completar con foto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {fotoDataUrl ? (
              <div className="relative">
                <img src={fotoDataUrl} alt="" className="w-full rounded-lg" />
                <button
                  type="button"
                  onClick={() => setFotoDataUrl(null)}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFotoSeleccionada}
                  className="hidden"
                />
                <Camera className="w-6 h-6" />
                <span className="text-sm">Hacer/elegir foto</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogFotoTareaId(null)} disabled={subiendoFoto}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarCompletarConFoto}
              disabled={subiendoFoto || !fotoDataUrl}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {subiendoFoto ? "Guardando..." : "Completar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TareasHoyWidget;
