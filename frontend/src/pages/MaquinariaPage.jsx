import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Wrench, Plus, ChevronRight, ChevronDown, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ESTADOS = [
  { value: "operativo", label: "Operativo", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  { value: "en_reparacion", label: "En reparación", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  { value: "fuera_servicio", label: "Fuera de servicio", dot: "bg-red-500", badge: "bg-red-50 text-red-700" },
];

const estadoInfo = (v) => ESTADOS.find((e) => e.value === v);

// La categoria es la primera palabra del nombre (Cortacésped, Sopladora,
// Desbrozadora, Cortasetos...), que es justo como viene el inventario.
const categoriaDe = (nombre) => {
  const limpio = (nombre || "").trim();
  if (!limpio) return "Otros";
  return limpio.split(/\s+/)[0];
};

const emptyForm = { nombre: "", marca: "", modelo: "", anio_fabricacion: "", ubicacion_actual: "", estado: "operativo" };

const MaquinariaPage = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [gruposPlegados, setGruposPlegados] = useState({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/maquinaria`);
      setItems(res.data);
    } catch (err) {
      console.error("Error cargando maquinaria:", err);
      toast.error("Error al cargar maquinaria y herramientas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // Agrupar por categoria (primera palabra), aplicando primero el filtro
  // de busqueda por nombre, marca, modelo o ubicacion.
  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = q
      ? items.filter((m) =>
          [m.nombre, m.marca, m.modelo, m.ubicacion_actual]
            .filter(Boolean)
            .some((campo) => campo.toLowerCase().includes(q))
        )
      : items;
    const mapa = {};
    filtrados.forEach((m) => {
      const cat = categoriaDe(m.nombre);
      if (!mapa[cat]) mapa[cat] = [];
      mapa[cat].push(m);
    });
    return Object.keys(mapa)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((cat) => ({
        categoria: cat,
        maquinas: mapa[cat].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es")),
      }));
  }, [items, busqueda]);

  const abrirNuevo = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const crear = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`${API}/maquinaria`, {
        nombre: form.nombre.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        anio_fabricacion: form.anio_fabricacion ? Number(form.anio_fabricacion) : null,
        ubicacion_actual: form.ubicacion_actual.trim() || null,
        estado: form.estado,
      });
      toast.success("Añadido correctamente");
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error creando maquinaria:", err);
      toast.error("Error al crear");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  return (
    <div data-testid="maquinaria-page">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Wrench className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Maquinaria y herramientas
            </h1>
            <p className="text-sm text-slate-500">
              {items.length} {items.length === 1 ? "elemento" : "elementos"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={abrirNuevo}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="nueva-maquinaria-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, marca, modelo o ubicación..."
            className="pl-9"
            data-testid="buscar-maquinaria-input"
          />
        </div>
      )}

      {items.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            Todavía no hay maquinaria ni herramientas registradas.
          </CardContent>
        </Card>
      ) : grupos.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            No se ha encontrado ninguna maquinaria que coincida con "{busqueda}".
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => {
            const plegado = gruposPlegados[grupo.categoria];
            return (
            <div key={grupo.categoria}>
              <button
                type="button"
                onClick={() =>
                  setGruposPlegados((prev) => ({
                    ...prev,
                    [grupo.categoria]: !prev[grupo.categoria],
                  }))
                }
                className="w-full flex items-center gap-2 mb-2 group"
                data-testid={`grupo-toggle-${grupo.categoria}`}
              >
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    plegado ? "-rotate-90" : ""
                  }`}
                />
                <h2 className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                  {grupo.categoria}
                </h2>
                <span className="text-xs text-slate-400">{grupo.maquinas.length}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </button>
              {!plegado && (
              <div className="space-y-2">
                {grupo.maquinas.map((m) => {
                  const info = estadoInfo(m.estado);
                  return (
                    <Card
                      key={m.id}
                      className="border-slate-100 cursor-pointer hover:border-indigo-200 transition-colors"
                      onClick={() => navigate(`/maquinaria/${m.id}`)}
                      data-testid={`maquinaria-${m.id}`}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {m.fotos?.[0] ? (
                            <img
                              src={m.fotos[0]}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                              <Wrench className="w-5 h-5 text-slate-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{m.nombre}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {(m.marca || m.modelo) && (
                                <span className="text-xs text-slate-500">
                                  {[m.marca, m.modelo].filter(Boolean).join(" ")}
                                </span>
                              )}
                              {m.anio_fabricacion && (
                                <span className="text-xs text-slate-400">{m.anio_fabricacion}</span>
                              )}
                              {m.ubicacion_actual && (
                                <span className="text-xs text-slate-400">{m.ubicacion_actual}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {info && (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${info.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
                              {info.label}
                            </span>
                          )}
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir maquinaria o herramienta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Desbrozadora Stihl FS 460"
                data-testid="nombre-maquinaria-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <Input
                  value={form.marca}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                  data-testid="marca-maquinaria-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input
                  value={form.modelo}
                  onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                  data-testid="modelo-maquinaria-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Año de fabricación</Label>
                <Input
                  type="number"
                  value={form.anio_fabricacion}
                  onChange={(e) => setForm((f) => ({ ...f, anio_fabricacion: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}>
                  <SelectTrigger>
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
                placeholder="Ej. Furgoneta 2, Nave central..."
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="crear-maquinaria-btn"
            >
              {guardando ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaquinariaPage;
