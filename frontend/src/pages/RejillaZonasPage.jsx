import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Image as ImageIcon, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

const RejillaZonasPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const [parte, setParte] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [dias, setDias] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [celdas, setCeldas] = useState({}); // { tarea_id: { fecha: [zonas] } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [guardandoCeldas, setGuardandoCeldas] = useState(new Set());
  const [mapaAbierto, setMapaAbierto] = useState(false);

  // Panel flotante ligero anclado a la celda pulsada (una sola instancia
  // para toda la rejilla, no una por celda: rapido incluso con cientos de
  // celdas). Se abre justo debajo del clic, se cierra al clicar fuera.
  const [panelAbierto, setPanelAbierto] = useState(null); // { tareaId, tareaNombre, fecha, top, left }

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

  // Cerrar el panel al clicar fuera de el
  useEffect(() => {
    if (!panelAbierto) return undefined;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelAbierto(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setPanelAbierto(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [panelAbierto]);

  const parteAbierto = parte?.estado === "abierto";

  const abrirPanel = (e, tareaId, tareaNombre, fecha) => {
    if (!parteAbierto) return;
    // Si ya esta abierto para esta misma celda, un segundo clic la cierra
    if (panelAbierto?.tareaId === tareaId && panelAbierto?.fecha === fecha) {
      setPanelAbierto(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const PANEL_ANCHO = 168;
    const PANEL_ALTO_ESTIMADO = 130;

    let left = rect.left + window.scrollX;
    if (left + PANEL_ANCHO > window.scrollX + window.innerWidth) {
      left = window.scrollX + window.innerWidth - PANEL_ANCHO - 8;
    }

    let top = rect.bottom + window.scrollY + 4;
    if (rect.bottom + PANEL_ALTO_ESTIMADO > window.innerHeight) {
      top = rect.top + window.scrollY - PANEL_ALTO_ESTIMADO - 4;
    }

    setPanelAbierto({ tareaId, tareaNombre, fecha, top, left });
  };

  const guardarCelda = async (tareaId, fecha, nuevasZonas) => {
    const key = `${tareaId}|${fecha}`;
    setGuardandoCeldas((prev) => new Set(prev).add(key));

    const anterior = celdas[tareaId]?.[fecha];
    setCeldas((prev) => {
      const copia = { ...prev, [tareaId]: { ...(prev[tareaId] || {}) } };
      if (nuevasZonas.length) copia[tareaId][fecha] = nuevasZonas;
      else delete copia[tareaId][fecha];
      return copia;
    });

    try {
      await axios.put(`${API}/work-orders/${id}/rejilla-zonas/celda`, {
        tarea_id: tareaId,
        fecha,
        zonas: nuevasZonas.length ? nuevasZonas : null,
      });
    } catch (err) {
      console.error("Error guardando celda:", err);
      toast.error("No se pudo guardar. Se revierte el cambio.");
      setCeldas((prev) => {
        const copia = { ...prev, [tareaId]: { ...(prev[tareaId] || {}) } };
        if (anterior) copia[tareaId][fecha] = anterior;
        else delete copia[tareaId][fecha];
        return copia;
      });
    } finally {
      setGuardandoCeldas((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  };

  const toggleZonaPanel = (zona) => {
    if (!panelAbierto) return;
    const { tareaId, fecha } = panelAbierto;
    const actuales = celdas[tareaId]?.[fecha] || [];
    let nuevas;
    if (zona === "X") {
      nuevas = actuales.includes("X") ? [] : ["X"];
    } else {
      const sinX = actuales.filter((z) => z !== "X");
      if (sinX.includes(zona)) {
        nuevas = sinX.filter((z) => z !== zona);
      } else if (sinX.length >= MAX_ZONAS_POR_CELDA) {
        toast.warning(`Máximo ${MAX_ZONAS_POR_CELDA} zonas por día`);
        nuevas = sinX;
      } else {
        nuevas = [...sinX, zona];
      }
    }
    guardarCelda(tareaId, fecha, nuevas);
  };

  const diasFormateados = useMemo(() => dias.map(formatearDiaCorto), [dias]);
  const zonasDelPanel = panelAbierto
    ? celdas[panelAbierto.tareaId]?.[panelAbierto.fecha] || []
    : [];

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
                    if (parte.rejilla_tipo === "semanal") {
                      const fmt = (iso) => {
                        const [y, m, d] = iso.split("-");
                        return `${Number(d)} ${MESES_ES[Number(m) - 1].slice(0, 3)}`;
                      };
                      const [yFin] = dias[dias.length - 1].split("-");
                      return `${fmt(dias[0])} - ${fmt(dias[dias.length - 1])} ${yFin}`;
                    }
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
        Clica una celda: se abre un desplegable rápido justo ahí para marcar hasta{" "}
        {MAX_ZONAS_POR_CELDA} zonas (A-M) o "X". Cada clic se guarda al momento.
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
                  const key = `${t.tarea_id}|${fecha}`;
                  const guardando = guardandoCeldas.has(key);
                  const activa =
                    panelAbierto?.tareaId === t.tarea_id && panelAbierto?.fecha === fecha;
                  return (
                    <td key={fecha} className="border-l border-slate-100 p-0 text-center">
                      <button
                        type="button"
                        disabled={!parteAbierto}
                        onClick={(e) => abrirPanel(e, t.tarea_id, t.tarea_nombre, fecha)}
                        className={`w-12 h-7 text-[10px] leading-tight border-0 cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                          activa ? "bg-indigo-100" : "bg-transparent hover:bg-indigo-50"
                        } ${
                          guardando
                            ? "opacity-50"
                            : zonas.length
                            ? "font-semibold text-indigo-700"
                            : "text-slate-300"
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

      {/* Panel flotante rapido: se ancla justo bajo la celda pulsada */}
      {panelAbierto && (
        <div
          ref={panelRef}
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-[168px]"
          style={{ top: panelAbierto.top, left: panelAbierto.left }}
          data-testid="panel-zonas-rapido"
        >
          <p className="text-[10px] text-slate-400 truncate mb-1.5 px-0.5">
            {panelAbierto.tareaNombre}
          </p>
          <button
            type="button"
            onClick={() => toggleZonaPanel("X")}
            className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs mb-1.5 transition-colors ${
              zonasDelPanel.includes("X")
                ? "bg-slate-200 text-slate-700 font-medium"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
            data-testid="panel-zona-X"
          >
            Sin zona (X)
            {zonasDelPanel.includes("X") && <Check className="w-3 h-3" />}
          </button>
          <div className="grid grid-cols-5 gap-1">
            {ZONA_LETRAS.map((letra) => {
              const activa = zonasDelPanel.includes(letra);
              return (
                <button
                  type="button"
                  key={letra}
                  onClick={() => toggleZonaPanel(letra)}
                  className={`h-7 rounded text-xs font-medium transition-colors ${
                    activa
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                  data-testid={`panel-zona-${letra}`}
                >
                  {letra}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
