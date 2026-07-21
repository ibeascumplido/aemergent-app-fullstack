import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Shirt, Plus, Minus, Pencil, Trash2, X, Check, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const emptyForm = { nombre: "", marca: "", notas: "" };

const RopaPage = () => {
  const { isAdmin } = useAuth();
  const [prendas, setPrendas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const [editandoTallas, setEditandoTallas] = useState(null); // prenda activa
  const [tallasForm, setTallasForm] = useState([]);
  const [guardandoTallas, setGuardandoTallas] = useState(false);

  const [editandoCantidad, setEditandoCantidad] = useState(null); // { prendaId, talla }
  const [valorEditado, setValorEditado] = useState("");

  const [aBorrar, setABorrar] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [resolviendo, setResolviendo] = useState(null);

  const cargarSolicitudes = async () => {
    try {
      const res = await axios.get(`${API}/solicitudes-ropa`, { params: { estado: "pendiente" } });
      setSolicitudes(res.data);
    } catch (err) {
      console.error("Error cargando solicitudes:", err);
    }
  };

  const resolverSolicitud = async (solicitudId, accion) => {
    setResolviendo(solicitudId);
    try {
      await axios.put(`${API}/solicitudes-ropa/${solicitudId}/${accion}`);
      toast.success(accion === "aprobar" ? "Solicitud aprobada" : "Solicitud rechazada");
      await Promise.all([cargarSolicitudes(), cargar()]);
    } catch (err) {
      console.error("Error resolviendo solicitud:", err);
      toast.error(err?.response?.data?.detail || "No se pudo resolver la solicitud");
    } finally {
      setResolviendo(null);
    }
  };

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/ropa`);
      setPrendas(res.data);
    } catch (err) {
      console.error("Error cargando ropa:", err);
      toast.error("Error al cargar el stock de ropa");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    if (isAdmin) cargarSolicitudes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirNuevo = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const crear = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre de la prenda es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`${API}/ropa`, {
        nombre: form.nombre.trim(),
        marca: form.marca.trim() || null,
        notas: form.notas.trim(),
        tallas: [],
      });
      toast.success("Prenda creada");
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error creando prenda:", err);
      toast.error("Error al crear");
    } finally {
      setGuardando(false);
    }
  };

  const abrirEdicionCantidad = (prendaId, talla, cantidadActual) => {
    setEditandoCantidad({ prendaId, talla });
    setValorEditado(String(cantidadActual));
  };

  const confirmarNuevoValor = async (prendaId, talla) => {
    const nuevo = Number(valorEditado);
    setEditandoCantidad(null);
    if (!Number.isFinite(nuevo) || nuevo < 0) {
      toast.error("Introduce un número válido");
      return;
    }
    // Actualizacion optimista
    setPrendas((prev) =>
      prev.map((p) => {
        if (p.id !== prendaId) return p;
        return {
          ...p,
          tallas: p.tallas.map((t) => (t.talla === talla ? { ...t, cantidad: nuevo } : t)),
        };
      })
    );
    try {
      await axios.put(
        `${API}/ropa/${prendaId}/tallas/${encodeURIComponent(talla)}/establecer`,
        { cantidad: nuevo }
      );
      toast.success("Stock actualizado");
    } catch (err) {
      console.error("Error fijando el stock:", err);
      toast.error("No se pudo guardar");
      await cargar();
    }
  };

  const ajustar = async (prendaId, talla, delta) => {
    // Actualizacion optimista
    setPrendas((prev) =>
      prev.map((p) => {
        if (p.id !== prendaId) return p;
        return {
          ...p,
          tallas: p.tallas.map((t) =>
            t.talla === talla ? { ...t, cantidad: Math.max(0, t.cantidad + delta) } : t
          ),
        };
      })
    );
    try {
      await axios.put(`${API}/ropa/${prendaId}/tallas/${encodeURIComponent(talla)}/ajustar`, {
        delta,
      });
    } catch (err) {
      console.error("Error ajustando stock:", err);
      toast.error("No se pudo guardar el ajuste");
      await cargar();
    }
  };

  const abrirEditorTallas = (prenda) => {
    setEditandoTallas(prenda);
    setTallasForm(prenda.tallas.map((t) => ({ ...t })));
  };

  const anadirFilaTalla = () => {
    setTallasForm((prev) => [...prev, { talla: "", cantidad: 0 }]);
  };

  const quitarFilaTalla = (i) => {
    setTallasForm((prev) => prev.filter((_, idx) => idx !== i));
  };

  const guardarTallas = async () => {
    const limpio = tallasForm
      .map((t) => ({ talla: t.talla.trim(), cantidad: Number(t.cantidad) || 0 }))
      .filter((t) => t.talla);
    setGuardandoTallas(true);
    try {
      await axios.put(`${API}/ropa/${editandoTallas.id}/tallas`, { tallas: limpio });
      toast.success("Tallas actualizadas");
      setEditandoTallas(null);
      await cargar();
    } catch (err) {
      console.error("Error guardando tallas:", err);
      toast.error("No se pudo guardar");
    } finally {
      setGuardandoTallas(false);
    }
  };

  const eliminarPrenda = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/ropa/${aBorrar.id}`);
      toast.success("Prenda eliminada");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando prenda:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  return (
    <div data-testid="ropa-page">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Shirt className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Ropa
            </h1>
            <p className="text-sm text-slate-500">
              {prendas.length} {prendas.length === 1 ? "prenda" : "prendas"} en el catálogo
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={abrirNuevo}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="nueva-prenda-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva prenda
          </Button>
        )}
      </div>

      {isAdmin && solicitudes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 mb-6">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Solicitudes pendientes ({solicitudes.length})
            </p>
            <div className="space-y-2">
              {solicitudes.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white border border-amber-100"
                  data-testid={`solicitud-${s.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{s.operario_nombre}</span> pidió{" "}
                      {s.prenda_nombre} talla {s.talla} x{s.cantidad}
                    </p>
                    {s.notas && <p className="text-xs text-slate-400 mt-0.5">{s.notas}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => resolverSolicitud(s.id, "aprobar")}
                      disabled={resolviendo === s.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-testid={`aprobar-solicitud-${s.id}`}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolverSolicitud(s.id, "rechazar")}
                      disabled={resolviendo === s.id}
                      data-testid={`rechazar-solicitud-${s.id}`}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {prendas.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            Todavía no hay prendas registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {prendas.map((p) => {
            const total = p.tallas.reduce((sum, t) => sum + t.cantidad, 0);
            return (
              <Card key={p.id} className="border-slate-100" data-testid={`prenda-${p.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {p.nombre}
                        {p.marca && (
                          <span className="text-xs font-normal text-slate-400 ml-2">
                            {p.marca}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">{total} unidades en total</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirEditorTallas(p)}
                          data-testid={`editar-tallas-${p.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Editar tallas
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setABorrar(p)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {p.tallas.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Sin tallas configuradas todavía.
                      {isAdmin && " Usa \"Editar tallas\" para añadirlas."}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {p.tallas.map((t) => (
                        <div
                          key={t.talla}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <span className="text-xs font-semibold text-slate-600 w-8">
                            {t.talla}
                          </span>
                          <button
                            type="button"
                            onClick={() => ajustar(p.id, t.talla, -1)}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                            data-testid={`menos-${p.id}-${t.talla}`}
                          >
                            <Minus className="w-3 h-3 text-slate-500" />
                          </button>
                          {isAdmin && editandoCantidad?.prendaId === p.id && editandoCantidad?.talla === t.talla ? (
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={valorEditado}
                              onChange={(e) => setValorEditado(e.target.value)}
                              onBlur={() => confirmarNuevoValor(p.id, t.talla)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditandoCantidad(null);
                              }}
                              className="w-10 text-sm font-bold text-center border border-indigo-300 rounded"
                              data-testid={`input-cantidad-${p.id}-${t.talla}`}
                            />
                          ) : (
                            <span
                              onClick={() =>
                                isAdmin && abrirEdicionCantidad(p.id, t.talla, t.cantidad)
                              }
                              role={isAdmin ? "button" : undefined}
                              tabIndex={isAdmin ? 0 : undefined}
                              title={isAdmin ? "Pulsa para fijar un número nuevo (ej. al llegar un pedido)" : undefined}
                              className={`text-sm font-bold w-6 text-center ${
                                t.cantidad === 0 ? "text-red-500" : "text-slate-800"
                              } ${isAdmin ? "cursor-pointer hover:underline" : ""}`}
                              data-testid={`cantidad-${p.id}-${t.talla}`}
                            >
                              {t.cantidad}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => ajustar(p.id, t.talla, 1)}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                            data-testid={`mas-${p.id}-${t.talla}`}
                          >
                            <Plus className="w-3 h-3 text-slate-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Nueva prenda */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva prenda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Polo verano, Botas de seguridad..."
                data-testid="nombre-prenda-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Marca (opcional)</Label>
              <Input
                value={form.marca}
                onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                placeholder="Ej. Roly"
                data-testid="marca-prenda-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                rows={2}
              />
            </div>
            <p className="text-xs text-slate-400">
              Después de crearla, usa "Editar tallas" para añadir las tallas y su stock inicial.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={crear}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="crear-prenda-btn"
            >
              {guardando ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor de tallas */}
      <Dialog open={!!editandoTallas} onOpenChange={(v) => !guardandoTallas && !v && setEditandoTallas(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tallas de {editandoTallas?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tallasForm.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={t.talla}
                  onChange={(e) =>
                    setTallasForm((prev) =>
                      prev.map((row, idx) => (idx === i ? { ...row, talla: e.target.value } : row))
                    )
                  }
                  placeholder="Talla (S, M, 42...)"
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  value={t.cantidad}
                  onChange={(e) =>
                    setTallasForm((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, cantidad: e.target.value } : row
                      )
                    )
                  }
                  className="w-20"
                />
                <button
                  type="button"
                  onClick={() => quitarFilaTalla(i)}
                  className="text-slate-400 hover:text-red-600 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={anadirFilaTalla}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              data-testid="anadir-fila-talla-btn"
            >
              + Añadir talla
            </button>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditandoTallas(null)}
              disabled={guardandoTallas}
            >
              Cancelar
            </Button>
            <Button
              onClick={guardarTallas}
              disabled={guardandoTallas}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="guardar-tallas-btn"
            >
              {guardandoTallas ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta prenda?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{aBorrar?.nombre}" y todo su stock. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarPrenda} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RopaPage;
