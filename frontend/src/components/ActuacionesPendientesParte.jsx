import { useEffect, useRef, useState } from "react";
import { ClipboardList, Plus, Trash2, Save, ImagePlus, X, Map as MapIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import BotonDictado from "@/components/BotonDictado";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ESTADOS = ["Pendiente", "Presupuestado", "Aprobado", "En curso", "Realizado"];

const filaVacia = () => ({
  tipo_trabajo: "",
  presupuesto: "",
  zona: "",
  estado: "Pendiente",
  anotaciones: "",
});

// Reduce la imagen del plano antes de subirla (los planos escaneados pesan mucho)
const imagenADataUrl = (file, maxLado = 2400) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

/**
 * Actuaciones pendientes / futuros trabajos del parte. Si está activado,
 * el PDF del parte lleva una página más con esta tabla y el plano
 * (el plano propio del parte o, si no hay, el mapa de zonas del cliente).
 */
const ActuacionesPendientesParte = ({ parte, cliente, editable, onGuardado }) => {
  const [activas, setActivas] = useState(!!parte.actuaciones_activas);
  const [filas, setFilas] = useState([]);
  const [planoNuevo, setPlanoNuevo] = useState(null); // data-URL pendiente de subir
  const [quitarPlano, setQuitarPlano] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const inputPlanoRef = useRef(null);

  useEffect(() => {
    setActivas(!!parte.actuaciones_activas);
    const guardadas = parte.actuaciones_pendientes || [];
    setFilas(guardadas.length ? guardadas.map((f) => ({ ...filaVacia(), ...f })) : [filaVacia()]);
    setPlanoNuevo(null);
    setQuitarPlano(false);
    setCambios(false);
  }, [parte.id, parte.actuaciones_activas, parte.actuaciones_pendientes]);

  const marcarCambio = () => setCambios(true);

  const cambiarCampo = (idx, campo, valor) => {
    setFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
    marcarCambio();
  };

  const anadirFila = () => {
    setFilas((prev) => [...prev, filaVacia()]);
    marcarCambio();
  };

  const borrarFila = (idx) => {
    setFilas((prev) => {
      const resto = prev.filter((_, i) => i !== idx);
      return resto.length ? resto : [filaVacia()];
    });
    marcarCambio();
  };

  const elegirPlano = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El plano debe ser una imagen (JPG o PNG)");
      return;
    }
    try {
      setPlanoNuevo(await imagenADataUrl(file));
      setQuitarPlano(false);
      marcarCambio();
    } catch {
      toast.error("No se pudo leer la imagen");
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const body = { activas, filas };
      if (planoNuevo) body.plano = planoNuevo;
      else if (quitarPlano) body.plano = "";
      const res = await axios.put(`${API}/work-orders/${parte.id}/actuaciones-pendientes`, body);
      onGuardado?.(res.data);
      setCambios(false);
      toast.success(
        activas ? "Guardado. El PDF incluirá la página de actuaciones pendientes" : "Guardado"
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudieron guardar las actuaciones");
    } finally {
      setGuardando(false);
    }
  };

  const planoParte = quitarPlano ? null : planoNuevo || parte.actuaciones_plano_url;
  const planoMostrado = planoParte || (parte?.mapa_zonas_url || cliente?.mapa_zonas_url) || null;
  const origenPlano = planoParte
    ? "Plano propio de este parte"
    : (parte?.mapa_zonas_url || cliente?.mapa_zonas_url)
    ? "Mapa de zonas del centro o del cliente"
    : null;

  // Solo lectura: si no está activado no se muestra nada
  if (!editable && !parte.actuaciones_activas) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30 mb-6" data-testid="actuaciones-pendientes">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-semibold text-slate-800">Futuros trabajos (actuaciones pendientes)</p>
              <p className="text-xs text-slate-500">
                Se añade como una página más en el PDF del parte, con la tabla y el plano.
              </p>
            </div>
          </div>
          {editable && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-amber-600"
                checked={activas}
                onChange={(e) => {
                  setActivas(e.target.checked);
                  marcarCambio();
                }}
                data-testid="actuaciones-activar"
              />
              Incluir en el PDF
            </label>
          )}
        </div>

        {(activas || !editable) && (
          <>
            {/* Tabla (tarjetas apiladas en móvil, rejilla en escritorio) */}
            <div className="hidden md:grid grid-cols-[1.1fr_1fr_1.2fr_0.9fr_1.6fr_auto] gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 px-1">
              <span>Tipo de trabajo</span>
              <span>Presupuesto</span>
              <span>Zona (numerada)</span>
              <span>Estado</span>
              <span>Anotaciones</span>
              <span className="w-8" />
            </div>
            <div className="space-y-3 md:space-y-2">
              {filas.map((f, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr_1.2fr_0.9fr_1.6fr_auto] gap-2 rounded-lg border border-slate-200 bg-white p-3 md:p-1.5 md:items-start"
                >
                  <Input
                    placeholder="Tipo de trabajo"
                    value={f.tipo_trabajo}
                    disabled={!editable}
                    onChange={(e) => cambiarCampo(idx, "tipo_trabajo", e.target.value)}
                  />
                  <Input
                    placeholder="Presupuesto (si es fuera de mant.)"
                    value={f.presupuesto}
                    disabled={!editable}
                    onChange={(e) => cambiarCampo(idx, "presupuesto", e.target.value)}
                  />
                  <Input
                    placeholder="Zona (nº)"
                    className="bg-sky-50"
                    value={f.zona}
                    disabled={!editable}
                    onChange={(e) => cambiarCampo(idx, "zona", e.target.value)}
                  />
                  <select
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                    value={f.estado || "Pendiente"}
                    disabled={!editable}
                    onChange={(e) => cambiarCampo(idx, "estado", e.target.value)}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-start gap-1">
                    <textarea
                      rows={1}
                      placeholder="Anotaciones"
                      className="flex-1 min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                      value={f.anotaciones}
                      disabled={!editable}
                      onChange={(e) => cambiarCampo(idx, "anotaciones", e.target.value)}
                    />
                    {editable && (
                      <BotonDictado
                        onTexto={(t) =>
                          cambiarCampo(
                            idx,
                            "anotaciones",
                            (f.anotaciones ? f.anotaciones.trimEnd() + " " : "") + t
                          )
                        }
                      />
                    )}
                  </div>
                  {editable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 justify-self-end"
                      onClick={() => borrarFila(idx)}
                      title="Quitar fila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <span className="hidden md:block w-8" />
                  )}
                </div>
              ))}
            </div>

            {editable && (
              <Button type="button" variant="outline" size="sm" onClick={anadirFila}>
                <Plus className="w-4 h-4 mr-1" /> Añadir trabajo
              </Button>
            )}

            {/* Plano */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapIcon className="w-4 h-4" /> Zona (gráfico)
                  {origenPlano && (
                    <span className="text-xs font-normal text-slate-500">· {origenPlano}</span>
                  )}
                </p>
                {editable && (
                  <div className="flex gap-2">
                    <input
                      ref={inputPlanoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={elegirPlano}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inputPlanoRef.current?.click()}
                    >
                      <ImagePlus className="w-4 h-4 mr-1" />
                      {planoParte ? "Cambiar plano" : "Subir plano propio"}
                    </Button>
                    {planoParte && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => {
                          setPlanoNuevo(null);
                          setQuitarPlano(true);
                          marcarCambio();
                        }}
                      >
                        <X className="w-4 h-4 mr-1" /> Quitar
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {planoMostrado ? (
                <img
                  src={planoMostrado}
                  alt="Plano de zonas"
                  className="w-full max-h-96 object-contain rounded border border-slate-100"
                />
              ) : (
                <p className="text-xs text-slate-500">
                  No hay plano. Sube uno aquí o añade el mapa de zonas en la ficha del cliente.
                </p>
              )}
            </div>
          </>
        )}

        {editable && (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={guardar}
              disabled={guardando || !cambios}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="actuaciones-guardar"
            >
              <Save className="w-4 h-4 mr-1" />
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActuacionesPendientesParte;
