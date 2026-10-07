import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  AlertTriangle,
  Plus,
  RotateCcw,
  Trash2,
  Pencil,
  Camera,
  X,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
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
import { useAuth } from "@/contexts/AuthContext";
import EditarIncidenciaDialog from "@/components/EditarIncidenciaDialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Convierte una lista de File (input de fotos) en data-URIs base64, que es
// el formato que acepta el backend (igual que el resto de subidas de fotos
// de la app). Ignora silenciosamente lo que no sea imagen.
const leerFotosComoDataUrl = (fileList) => {
  const archivos = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
  return Promise.all(
    archivos.map(
      (file) =>
        new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        })
    )
  );
};

/**
 * Incidencias por cliente (Fase 16): problemas/avisos abiertos. Pensado
 * para en el futuro conectarse con el correo (cualquier email
 * referenciado a este cliente se archivaria aqui automaticamente).
 *
 * Fase 17: se pueden adjuntar fotos al crear la incidencia (quedan
 * archivadas tambien en la galeria de fotos del centro), y al cerrarla se
 * elige entre dos caminos: generar un parte de trabajo (para transmitir al
 * cliente) o un cierre interno con notas + fotos del "despues".
 */
const IncidenciasCliente = ({ clientId, centroId, centros }) => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verCerradas, setVerCerradas] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [centroElegido, setCentroElegido] = useState(""); // solo relevante si no hay centroId fijo
  const [fotosNuevas, setFotosNuevas] = useState([]); // data-URIs, foto(s) al crear
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  const [aEditar, setAEditar] = useState(null);
  const inputFotosRef = useRef(null);

  // Cierre de incidencia: dos caminos (parte de trabajo / interno).
  const [cerrando, setCerrando] = useState(null); // la incidencia que se esta cerrando, o null
  const [cierrePaso, setCierrePaso] = useState("elegir"); // "elegir" | "interno"
  const [cierreNotas, setCierreNotas] = useState("");
  const [cierreFotos, setCierreFotos] = useState([]); // data-URIs, fotos del "despues"
  const [procesandoCierre, setProcesandoCierre] = useState(false);
  const inputFotosCierreRef = useRef(null);

  // Permite elegir centro en el dialogo solo cuando se usa a nivel de
  // cliente (sin centroId fijo) y se nos ha pasado la lista de centros.
  const puedeElegirCentro = !centroId && Array.isArray(centros) && centros.length > 0;
  const centroPorId = (id) => (centros || []).find((c) => c.id === id);

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
    setCentroElegido("");
    setFotosNuevas([]);
    setDialogOpen(true);
  };

  const onElegirFotosNuevas = async (e) => {
    const nuevas = await leerFotosComoDataUrl(e.target.files);
    e.target.value = "";
    if (nuevas.length === 0) return;
    setFotosNuevas((prev) => [...prev, ...nuevas].slice(0, 10));
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
        centro_id: centroId || centroElegido || null,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fotos: fotosNuevas.length > 0 ? fotosNuevas : undefined,
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

  // --- Cierre --------------------------------------------------------

  const abrirCierre = (incidencia) => {
    setCerrando(incidencia);
    setCierrePaso("elegir");
    setCierreNotas("");
    setCierreFotos([]);
  };

  const cerrarDialogoCierre = () => {
    if (procesandoCierre) return;
    setCerrando(null);
  };

  const elegirHacerParte = async () => {
    if (!cerrando) return;
    setProcesandoCierre(true);
    try {
      const resParte = await axios.post(`${API}/work-orders`, {
        client_id: clientId,
        centro_id: centroId || cerrando.centro_id || null,
        titulo: cerrando.titulo,
        usa_zonas: false,
      });
      const nuevoParteId = resParte.data.id;
      await axios.put(`${API}/incidencias/${cerrando.id}/cerrar`, {
        cierre_tipo: "parte",
        work_order_id: nuevoParteId,
      });
      toast.success("Parte creado e incidencia cerrada");
      setCerrando(null);
      navigate(`/work-orders/${nuevoParteId}`);
    } catch (err) {
      console.error("Error creando parte desde incidencia:", err);
      toast.error("No se pudo crear el parte");
    } finally {
      setProcesandoCierre(false);
    }
  };

  const onElegirFotosCierre = async (e) => {
    const nuevas = await leerFotosComoDataUrl(e.target.files);
    e.target.value = "";
    if (nuevas.length === 0) return;
    setCierreFotos((prev) => [...prev, ...nuevas].slice(0, 10));
  };

  const guardarCierreInterno = async () => {
    if (!cerrando) return;
    setProcesandoCierre(true);
    try {
      await axios.put(`${API}/incidencias/${cerrando.id}/cerrar`, {
        cierre_tipo: "interno",
        cierre_notas: cierreNotas.trim(),
        cierre_fotos: cierreFotos.length > 0 ? cierreFotos : undefined,
      });
      toast.success("Incidencia cerrada");
      setCerrando(null);
      await cargar();
    } catch (err) {
      console.error("Error cerrando incidencia:", err);
      toast.error("No se pudo cerrar");
    } finally {
      setProcesandoCierre(false);
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
                <div className="min-w-0 flex-1">
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
                  {puedeElegirCentro && i.centro_id && centroPorId(i.centro_id) && (
                    <p className="text-xs text-indigo-500 mt-0.5">
                      📍 {centroPorId(i.centro_id).nombre}
                    </p>
                  )}

                  {i.fotos && i.fotos.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {i.fotos.map((f) => (
                        <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                          <img
                            src={f.url}
                            alt="Foto de la incidencia"
                            className="w-12 h-12 rounded-md object-cover border border-orange-200"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-1">
                    {i.estado === "abierta"
                      ? `Abierta por ${i.creado_por_nombre} · ${new Date(i.creado_en).toLocaleDateString("es-ES")}`
                      : `Cerrada por ${i.cerrado_por_nombre} · ${new Date(i.cerrado_en).toLocaleDateString("es-ES")}`}
                  </p>

                  {i.estado === "cerrada" && i.cierre_tipo === "parte" && i.work_order_id && (
                    <Link
                      to={`/work-orders/${i.work_order_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-1.5"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Ver parte de trabajo
                    </Link>
                  )}

                  {i.estado === "cerrada" && i.cierre_tipo === "interno" && (
                    <div className="mt-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-2">
                      <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cierre interno
                      </p>
                      {i.cierre_notas && (
                        <p className="text-xs text-emerald-800 mt-1 whitespace-pre-wrap">
                          {i.cierre_notas}
                        </p>
                      )}
                      {i.cierre_fotos && i.cierre_fotos.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {i.cierre_fotos.map((f) => (
                            <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                              <img
                                src={f.url}
                                alt="Foto del después"
                                className="w-12 h-12 rounded-md object-cover border border-emerald-200"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {i.estado === "abierta" ? (
                    <Button size="sm" variant="outline" onClick={() => abrirCierre(i)}>
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
                      onClick={() => setAEditar(i)}
                      className="text-slate-300 hover:text-indigo-500 p-1"
                      title="Editar incidencia"
                      data-testid={`editar-incidencia-${i.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
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

      {/* Nueva incidencia */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm max-h-[85dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-5 pb-0 shrink-0">
            <DialogTitle>Nueva incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-5 overflow-y-auto">
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
            {puedeElegirCentro && (
              <div className="space-y-1.5">
                <Label>Centro (opcional)</Label>
                <Select
                  value={centroElegido || "none"}
                  onValueChange={(v) => setCentroElegido(v === "none" ? "" : v)}
                >
                  <SelectTrigger data-testid="incidencia-centro-select">
                    <SelectValue placeholder="Sin centro específico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin centro específico</SelectItem>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  Si la eliges, la incidencia también aparecerá en la ficha de ese centro.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Fotos (opcional)</Label>
              <input
                ref={inputFotosRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onElegirFotosNuevas}
                data-testid="incidencia-fotos-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputFotosRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                Añadir foto
              </Button>
              {fotosNuevas.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {fotosNuevas.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={src}
                        alt=""
                        className="w-14 h-14 rounded-md object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFotosNuevas((prev) => prev.filter((_, i2) => i2 !== idx))}
                        className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-5 pt-0 shrink-0">
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

      {/* Cierre de incidencia: elegir parte vs. interno */}
      <Dialog open={!!cerrando} onOpenChange={(v) => !v && cerrarDialogoCierre()}>
        <DialogContent className="max-w-sm max-h-[85dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-5 pb-0 shrink-0">
            <DialogTitle>Cerrar incidencia</DialogTitle>
          </DialogHeader>

          {cierrePaso === "elegir" ? (
            <>
              <div className="p-5 space-y-3">
                <p className="text-sm text-slate-500">
                  "{cerrando?.titulo}" — ¿cómo quieres resolverla?
                </p>
                <button
                  type="button"
                  onClick={elegirHacerParte}
                  disabled={procesandoCierre}
                  className="w-full text-left rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors p-3.5 flex items-start gap-3 disabled:opacity-60"
                  data-testid="cierre-modo-parte"
                >
                  <ClipboardList className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-indigo-900">
                      Hacer parte de trabajo
                    </span>
                    <span className="block text-xs text-indigo-600 mt-0.5">
                      Para transmitírselo al cliente (firma, PDF, etc.). Se creará un parte
                      abierto y te llevará directo a él.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCierrePaso("interno")}
                  disabled={procesandoCierre}
                  className="w-full text-left rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors p-3.5 flex items-start gap-3 disabled:opacity-60"
                  data-testid="cierre-modo-interno"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-emerald-900">
                      Cierre interno
                    </span>
                    <span className="block text-xs text-emerald-600 mt-0.5">
                      Para algo visto internamente: anota qué se ha hecho y adjunta fotos del
                      después.
                    </span>
                  </span>
                </button>
              </div>
              <DialogFooter className="p-5 pt-0 shrink-0">
                <Button variant="ghost" onClick={cerrarDialogoCierre} disabled={procesandoCierre}>
                  Cancelar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3 p-5 overflow-y-auto">
                <div className="space-y-1.5">
                  <Label>¿Qué se ha hecho? (opcional)</Label>
                  <Textarea
                    value={cierreNotas}
                    onChange={(e) => setCierreNotas(e.target.value)}
                    rows={3}
                    placeholder="Ej. Revisado el riego, cambiado el aspersor de zona 2"
                    data-testid="cierre-notas-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fotos del después (opcional)</Label>
                  <input
                    ref={inputFotosCierreRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onElegirFotosCierre}
                    data-testid="cierre-fotos-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputFotosCierreRef.current?.click()}
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    Añadir foto
                  </Button>
                  {cierreFotos.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {cierreFotos.map((src, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={src}
                            alt=""
                            className="w-14 h-14 rounded-md object-cover border border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCierreFotos((prev) => prev.filter((_, i2) => i2 !== idx))
                            }
                            className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="p-5 pt-0 shrink-0">
                <Button
                  variant="ghost"
                  onClick={() => setCierrePaso("elegir")}
                  disabled={procesandoCierre}
                >
                  Atrás
                </Button>
                <Button
                  onClick={guardarCierreInterno}
                  disabled={procesandoCierre}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="guardar-cierre-interno-btn"
                >
                  {procesandoCierre ? "Cerrando..." : "Cerrar incidencia"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <EditarIncidenciaDialog
        incidencia={aEditar}
        onClose={() => setAEditar(null)}
        onSaved={cargar}
      />

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
