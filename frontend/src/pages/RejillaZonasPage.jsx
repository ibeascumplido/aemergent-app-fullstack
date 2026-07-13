import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Image as ImageIcon, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Mismas letras fijas que en SessionDialog (Fase 6): se corresponden con
// el mapa de zonas que el cliente tiene subido.
const ZONA_LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const MAX_ZONAS_POR_CELDA = 3;

const DIAS_SEMANA_CORTO = ["L", "M", "X", "J", "V", "S", "D"];
const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const formatearDiaCorto = (fechaISO) => {
  const d = new Date(fechaISO + "T00:00:00");
  return { numero: d.getDate(), semana: DIAS_SEMANA_CORTO[(d.getDay() + 6) % 7] };
};

const formatearFechaLarga = (fechaISO) => {
  const d = new Date(fechaISO + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
};

const RejillaZonasPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [parte, setParte] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [dias, setDias] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [celdas, setCeldas] = useState({}); // { tarea_id: { fecha: [zonas] } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  // Modal compartido de edicion de celda (una sola instancia, no una por celda)
  const [celdaActiva, setCeldaActiva] = useState(null); // { tareaId, tareaNombre, fecha }
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState([]);
  const [guardandoCelda, setGuardandoCelda] = useState(false);

  const cargar = async () => {
    setLoading(true);
    setError(false);
    try {
      const parteRes = await axios.get(`${API}/work-orders/${id}`);
      setParte(parteRes.data);

      if (!parteRes.data.usa_zonas) {
        setError(true);
        setLoading(false);
        return;
      }

      const [rejillaRes, clienteRes] = await Promise.all([
        axios.get(`${API}/work-orders/${id}/rejilla-zonas`),
        axios.get(`${API}/clients/${parteRes.data.client_slug}`).catch(() => ({ data: null })),
      ]);

      setDias(rejillaRes.data.dias);
      setTareas(rejillaRes.data.tareas);
      setCliente(clienteRes.data);

      const mapa = {};
      rejillaRes.data.celdas.forEach((c) => {
        if (!mapa[c.tarea_id]) mapa[c.tarea_id] = {};
        mapa[c.tarea_id][c.fecha] = c.zonas;
      });
      setCeldas(mapa);
    } catch (err) {
      console.error("Error cargando la rejilla:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const parteAbierto = parte?.estado === "abierto";

  const abrirCelda = (tareaId, tareaNombre, fecha) => {
    if (!parteAbierto) return;
    setZonasSeleccionadas(celdas[tareaId]?.[fecha] || []);
    setCeldaActiva({ tareaId, tareaNombre, fecha });
  };

  const toggleZonaModal = (zona) => {
    if (zona === "X") {
      setZonasSeleccionadas((prev) => (prev.includes("X") ? [] : ["X"]));
      return;
    }
    setZonasSeleccionadas((prev) => {
      const sinX = prev.filter((z) => z !== "X");
      if (sinX.includes(zona)) return sinX.filter((z) => z !== zona);
      if (sinX.length >= MAX_ZONAS_POR_CELDA) {
        toast.warning(`Máximo ${MAX_ZONAS_POR_CELDA} zonas por día`);
        return sinX;
      }
      return [...sinX, zona];
    });
  };

  const guardarCeldaModal = async () => {
    if (!celdaActiva) return;
    const { tareaId, fecha } = celdaActiva;
    setGuardandoCelda(true);
    try {
      await axios.put(`${API}/work-orders/${id}/rejilla-zonas/celda`, {
        tarea_id: tareaId,
        fecha,
        zonas: zonasSeleccionadas.length ? zonasSeleccionadas : null,
      });
      setCeldas((prev) => {
        const copia = { ...prev, [tareaId]: { ...(prev[tareaId] || {}) } };
        if (zonasSeleccionadas.length) copia[tareaId][fecha] = zonasSeleccionadas;
        else delete copia[tareaId][fecha];
        return copia;
      });
      setCeldaActiva(null);
    } catch (err) {
      console.error("Error guardando celda:", err);
      toast.error("No se pudo guardar. Intentalo de nuevo.");
    } finally {
      setGuardandoCelda(false);
    }
  };

  const diasFormateados = useMemo(() => dias.map(formatearDiaCorto), [dias]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando rejilla...</div>;
  }

  if (error || !parte) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">
            Este parte no tiene la rejilla de zonas activada.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="rejilla-zonas-page">
      <Button
        variant="ghost"
        onClick={() => navigate(`/work-orders/${id}`)}
        className="mb-2 text-slate-600 hover:text-slate-900 -ml-3"
        size="sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver al parte
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Rejilla de zonas
            </h1>
            <p className="text-sm text-slate-500">
              {parte.titulo}
              {dias.length > 0 && (
                <span className="ml-2 text-slate-400">
                  ·{" "}
                  {(() => {
                    const [y, m] = dias[0].split("-");
                    return `${MESES_ES[Number(m) - 1]} de ${y}`;
                  })()}
                </span>
              )}
            </p>
          </div>
        </div>
        {cliente?.mapa_zonas_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapaAbierto(true)}
            className="border-slate-200"
            data-testid="ver-mapa-zonas-btn"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Ver mapa de zonas
          </Button>
        )}
      </div>

      {!parteAbierto && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          Este parte no está abierto: la rejilla se muestra en solo lectura.
        </p>
      )}

      <p className="text-xs text-slate-400 mb-3">
        Clica una celda y elige hasta {MAX_ZONAS_POR_CELDA} zonas (A-M) donde se hizo esa
        tarea ese día, o "X" si no aplica una zona concreta. Deja en blanco si no se hizo.
      </p>

      <div className="border border-slate-200 rounded-lg overflow-auto max-w-full">
        <table className="border-collapse text-xs min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-600 min-w-[220px]">
                Tarea
              </th>
              {diasFormateados.map((d, i) => (
                <th
                  key={dias[i]}
                  className="bg-slate-50 border-b border-slate-200 px-1 py-1 text-center font-medium text-slate-500 w-12"
                >
                  <div>{d.numero}</div>
                  <div className="text-[9px] text-slate-400 font-normal">{d.semana}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tareas.map((t) => (
              <tr key={t.tarea_id} className="odd:bg-white even:bg-slate-50/50">
                <td className="sticky left-0 z-10 bg-inherit border-r border-slate-200 px-3 py-1 text-slate-700 truncate max-w-[220px]">
                  {t.tarea_nombre}
                </td>
                {dias.map((fecha) => {
                  const zonas = celdas[t.tarea_id]?.[fecha] || [];
                  const texto = zonas.join(",");
                  return (
                    <td key={fecha} className="border-l border-slate-100 p-0 text-center">
                      <button
                        type="button"
                        disabled={!parteAbierto}
                        onClick={() => abrirCelda(t.tarea_id, t.tarea_nombre, fecha)}
                        className={`w-12 h-7 text-[10px] leading-tight border-0 bg-transparent hover:bg-indigo-50 cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                          zonas.length ? "font-semibold text-indigo-700" : "text-slate-300"
                        }`}
                        data-testid={`celda-${t.tarea_id}-${fecha}`}
                        title={texto || "Sin asignar"}
                      >
                        {texto || "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal compartido: editar zonas de una celda (hasta 3) */}
      <Dialog
        open={!!celdaActiva}
        onOpenChange={(v) => !guardandoCelda && !v && setCeldaActiva(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {celdaActiva?.tareaNombre}
              {celdaActiva && (
                <span className="block text-sm font-normal text-slate-500 mt-0.5 capitalize">
                  {formatearFechaLarga(celdaActiva.fecha)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <button
              type="button"
              onClick={() => toggleZonaModal("X")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                zonasSeleccionadas.includes("X")
                  ? "bg-slate-100 border-slate-300 text-slate-700 font-medium"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
              data-testid="modal-zona-X"
            >
              Sin zona concreta (X)
              {zonasSeleccionadas.includes("X") && <Check className="w-4 h-4" />}
            </button>

            <div>
              <p className="text-xs text-slate-400 mb-1.5">
                O hasta {MAX_ZONAS_POR_CELDA} zonas concretas:
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {ZONA_LETRAS.map((letra) => {
                  const activa = zonasSeleccionadas.includes(letra);
                  return (
                    <button
                      type="button"
                      key={letra}
                      onClick={() => toggleZonaModal(letra)}
                      className={`h-9 rounded-lg border text-sm font-medium transition-colors ${
                        activa
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      data-testid={`modal-zona-${letra}`}
                    >
                      {letra}
                    </button>
                  );
                })}
              </div>
            </div>

            {zonasSeleccionadas.length > 0 && zonasSeleccionadas[0] !== "X" && (
              <p className="text-xs text-slate-400">
                Seleccionadas: {zonasSeleccionadas.join(", ")} ({zonasSeleccionadas.length}/
                {MAX_ZONAS_POR_CELDA})
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCeldaActiva(null)}
              disabled={guardandoCelda}
            >
              Cancelar
            </Button>
            <Button
              onClick={guardarCeldaModal}
              disabled={guardandoCelda}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="guardar-celda-btn"
            >
              {guardandoCelda ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mapaAbierto} onOpenChange={setMapaAbierto}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Mapa de zonas — {cliente?.nombre}</DialogTitle>
          {cliente?.mapa_zonas_url && (
            <img
              src={cliente.mapa_zonas_url}
              alt="Mapa de zonas"
              className="w-full h-auto rounded-lg border border-slate-200"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RejillaZonasPage;
