import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Search,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Mismo mapeo fijo que el backend (FRECUENCIA_OBJETIVO_VISITAS): confirmado
// sobre datos reales, no es literal (p.ej. trimestral son 3 visitas/año,
// no 4). Se autorellena al elegir la frecuencia, queda editable despues.
const FRECUENCIA_OBJETIVO = {
  MENSUAL: 8,
  BIMESTRAL: 4,
  TRIMESTRAL: 3,
  SEMESTRAL: 2,
  ANUAL: 1,
};
const FRECUENCIAS = Object.keys(FRECUENCIA_OBJETIVO);

const DIFICULTADES = [
  { value: "facil", label: "Fácil", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  { value: "media", label: "Media", dot: "bg-orange-300", badge: "bg-orange-50 text-orange-700" },
  { value: "dificil", label: "Difícil", dot: "bg-red-500", badge: "bg-red-50 text-red-700" },
];

const dificultadInfo = (v) => DIFICULTADES.find((d) => d.value === v);

const emptyForm = {
  nombre: "",
  referencia_cliente: "",
  direccion: "",
  email_contacto: "",
  enlace_maps: "",
  horas_por_visita: "",
  frecuencia: "",
  visitas_objetivo_ano: "",
  responsable_id: "none",
  responsable_texto_libre: "",
  dificultad: "none",
  notas: "",
};

const ClientLocationsPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [cliente, setCliente] = useState(null);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = async () => {
    try {
      const [cRes, uRes, opsRes] = await Promise.all([
        axios.get(`${API}/clients/${slug}`),
        axios.get(`${API}/clients/${slug}/locations`),
        axios.get(`${API}/users/operarios`).catch(() => ({ data: [] })),
      ]);
      setCliente(cRes.data);
      setUbicaciones(uRes.data);
      setOperarios(opsRes.data);
    } catch (err) {
      console.error("Error cargando ubicaciones:", err);
      toast.error("Error al cargar las ubicaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const operariosPorId = useMemo(() => {
    const map = {};
    operarios.forEach((o) => (map[o.user_id] = o.name));
    return map;
  }, [operarios]);

  const ubicacionesFiltradas = ubicaciones.filter((u) =>
    [u.nombre, u.referencia_cliente, u.direccion]
      .filter(Boolean)
      .some((campo) => campo.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const abrirNueva = () => {
    setEditando(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({
      nombre: u.nombre || "",
      referencia_cliente: u.referencia_cliente || "",
      direccion: u.direccion || "",
      email_contacto: u.email_contacto || "",
      enlace_maps: u.enlace_maps || "",
      horas_por_visita: u.horas_por_visita ?? "",
      frecuencia: u.frecuencia || "",
      visitas_objetivo_ano: u.visitas_objetivo_ano ?? "",
      responsable_id: u.responsable_id || "none",
      responsable_texto_libre: u.responsable_texto_libre || "",
      dificultad: u.dificultad || "none",
      notas: u.notas || "",
    });
    setDialogOpen(true);
  };

  const cambiarFrecuencia = (v) => {
    setForm((f) => ({
      ...f,
      frecuencia: v,
      visitas_objetivo_ano: FRECUENCIA_OBJETIVO[v] ?? f.visitas_objetivo_ano,
    }));
  };

  const guardar = async () => {
    const nombre = form.nombre.trim();
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!form.frecuencia) {
      toast.error("Selecciona una frecuencia");
      return;
    }
    if (form.horas_por_visita === "" || Number(form.horas_por_visita) < 0) {
      toast.error("Indica las horas por visita");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        nombre,
        referencia_cliente: form.referencia_cliente.trim() || null,
        direccion: form.direccion.trim(),
        email_contacto: form.email_contacto.trim() || null,
        enlace_maps: form.enlace_maps.trim() || null,
        horas_por_visita: Number(form.horas_por_visita),
        frecuencia: form.frecuencia,
        visitas_objetivo_ano: Number(form.visitas_objetivo_ano) || 0,
        responsable_id: form.responsable_id === "none" ? null : form.responsable_id,
        responsable_texto_libre: form.responsable_texto_libre.trim(),
        dificultad: form.dificultad === "none" ? null : form.dificultad,
        notas: form.notas.trim(),
      };
      if (editando) {
        await axios.put(`${API}/locations/${editando.id}`, payload);
        toast.success("Ubicación actualizada");
      } else {
        await axios.post(`${API}/clients/${slug}/locations`, payload);
        toast.success("Ubicación creada");
      }
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error guardando ubicación:", err);
      toast.error("Error al guardar la ubicación");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await axios.delete(`${API}/locations/${aBorrar.id}`);
      toast.success("Ubicación eliminada");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando ubicación:", err);
      toast.error("Error al eliminar la ubicación");
    } finally {
      setBorrando(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando ubicaciones...</div>;
  }

  return (
    <div data-testid="client-locations-page">
      <Button
        variant="ghost"
        onClick={() => navigate(cliente ? `/clients/${cliente.slug}` : "/clients")}
        className="mb-2 text-slate-600 hover:text-slate-900 -ml-3"
        size="sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {cliente ? `Volver a ${cliente.nombre}` : "Volver"}
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Ubicaciones
            </h1>
            <p className="text-sm text-slate-500">
              {cliente?.nombre} · {ubicaciones.length}{" "}
              {ubicaciones.length === 1 ? "ubicación" : "ubicaciones"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/clients/${slug}/locations/calendar`)}
            className="border-slate-200"
            data-testid="ver-calendario-btn"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Ver calendario
          </Button>
          {isAdmin && (
            <Button
              onClick={abrirNueva}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="nueva-ubicacion-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva ubicación
            </Button>
          )}
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por nombre, referencia o dirección..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
          data-testid="buscar-ubicacion-input"
        />
      </div>

      {ubicacionesFiltradas.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            {ubicaciones.length === 0
              ? "Este cliente todavía no tiene ubicaciones."
              : "Sin resultados para esa búsqueda."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {ubicacionesFiltradas.map((u) => {
            const dif = dificultadInfo(u.dificultad);
            return (
              <Card key={u.id} className="border-slate-100" data-testid={`ubicacion-${u.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {dif && (
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${dif.dot}`}
                            title={dif.label}
                          />
                        )}
                        <span className="font-medium text-slate-900 truncate">{u.nombre}</span>
                        {u.referencia_cliente && (
                          <span className="text-xs text-slate-400 font-mono">
                            {u.referencia_cliente}
                          </span>
                        )}
                        {u.enlace_maps && (
                          <a
                            href={u.enlace_maps}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-indigo-600"
                            title="Ver en Google Maps"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mt-1.5 text-xs text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                          {u.frecuencia} · {u.visitas_objetivo_ano}{" "}
                          {u.visitas_objetivo_ano === 1 ? "visita" : "visitas"}/año
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            u.visitas_pendientes_ano === 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                          data-testid={`visitas-contador-${u.id}`}
                        >
                          {u.visitas_realizadas_ano}/{u.visitas_objetivo_ano} este año
                        </span>
                        <span>{u.horas_por_visita} h/visita (estimado)</span>
                        {u.visitas_realizadas_ano > 0 && (
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium ${
                              u.horas_realizadas_ano > u.horas_estimadas_ano
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                            title={`Estimado para las ${u.visitas_realizadas_ano} visitas ya hechas: ${u.horas_estimadas_ano}h`}
                            data-testid={`horas-estimadas-reales-${u.id}`}
                          >
                            {u.horas_estimadas_ano}h est. · {u.horas_realizadas_ano}h real
                          </span>
                        )}
                        {u.responsable_id ? (
                          <span>{operariosPorId[u.responsable_id] || "Operario"}</span>
                        ) : (
                          u.responsable_texto_libre && <span>{u.responsable_texto_libre}</span>
                        )}
                      </div>
                      {u.direccion && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{u.direccion}</p>
                      )}
                      {u.visitas_detalle?.length > 0 && (
                        <p
                          className="text-[11px] text-slate-400 mt-1.5 leading-relaxed"
                          data-testid={`visitas-detalle-${u.id}`}
                        >
                          {u.visitas_detalle.map((v, i) => (
                            <span key={v.fecha + i}>
                              {i > 0 && " · "}
                              {new Date(v.fecha).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                              })}
                              : {v.horas_totales}h
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-slate-100"
                          onClick={() => abrirEditar(u)}
                          data-testid={`editar-ubicacion-${u.id}`}
                        >
                          <Pencil className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-red-50"
                          onClick={() => setABorrar(u)}
                          data-testid={`borrar-ubicacion-${u.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogo crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar ubicación" : "Nueva ubicación"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="loc-nombre">Nombre oficial</Label>
              <Input
                id="loc-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. S.S.de los Reyes-Jarama"
                data-testid="loc-nombre-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="loc-referencia">Referencia del cliente</Label>
                <Input
                  id="loc-referencia"
                  value={form.referencia_cliente}
                  onChange={(e) => setForm((f) => ({ ...f, referencia_cliente: e.target.value }))}
                  placeholder="Ej. E0803"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-email">Email de contacto</Label>
                <Input
                  id="loc-email"
                  type="email"
                  value={form.email_contacto}
                  onChange={(e) => setForm((f) => ({ ...f, email_contacto: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loc-direccion">Dirección (opcional)</Label>
              <Input
                id="loc-direccion"
                value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loc-maps">Enlace de Google Maps</Label>
              <Input
                id="loc-maps"
                value={form.enlace_maps}
                onChange={(e) => setForm((f) => ({ ...f, enlace_maps: e.target.value }))}
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frecuencia</Label>
                <Select value={form.frecuencia} onValueChange={cambiarFrecuencia}>
                  <SelectTrigger data-testid="loc-frecuencia-select">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FRECUENCIAS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-objetivo">Visitas objetivo/año</Label>
                <Input
                  id="loc-objetivo"
                  type="number"
                  min="0"
                  value={form.visitas_objetivo_ano}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, visitas_objetivo_ano: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loc-horas">Horas por visita</Label>
              <Input
                id="loc-horas"
                type="number"
                min="0"
                step="0.5"
                value={form.horas_por_visita}
                onChange={(e) => setForm((f) => ({ ...f, horas_por_visita: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Select
                value={form.responsable_id}
                onValueChange={(v) => setForm((f) => ({ ...f, responsable_id: v }))}
              >
                <SelectTrigger data-testid="loc-responsable-select">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {operarios.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={form.responsable_texto_libre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, responsable_texto_libre: e.target.value }))
                }
                placeholder="O escribe un nombre si no está registrado en la app"
                className="text-sm"
                data-testid="loc-responsable-libre-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Dificultad</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, dificultad: "none" }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.dificultad === "none"
                      ? "bg-slate-100 border-slate-300 text-slate-700"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Sin marcar
                </button>
                {DIFICULTADES.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => setForm((f) => ({ ...f, dificultad: d.value }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors inline-flex items-center gap-1.5 ${
                      form.dificultad === d.value
                        ? `${d.badge} border-current`
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                    data-testid={`dificultad-${d.value}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${d.dot}`} />
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loc-notas">Notas (opcional)</Label>
              <Textarea
                id="loc-notas"
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                rows={3}
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
              data-testid="guardar-ubicacion-btn"
            >
              {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear ubicación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta ubicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-semibold">{aBorrar?.nombre}</span>. El
              historial de visitas no se borra, pero la ubicación dejará de aparecer en el
              catálogo activo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              disabled={borrando}
              className="bg-red-600 hover:bg-red-700"
            >
              {borrando ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientLocationsPage;
