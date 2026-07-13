import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Mismas letras fijas que en SessionDialog (Fase 6): se corresponden con
// el mapa de zonas que el cliente tiene subido.
const ZONA_LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

const DIAS_SEMANA_CORTO = ["L", "M", "X", "J", "V", "S", "D"];

const formatearDiaCorto = (fechaISO) => {
  const d = new Date(fechaISO + "T00:00:00");
  return { numero: d.getDate(), semana: DIAS_SEMANA_CORTO[(d.getDay() + 6) % 7] };
};

const RejillaZonasPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [parte, setParte] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [dias, setDias] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [celdas, setCeldas] = useState({}); // { tarea_id: { fecha: zona } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [guardandoCeldas, setGuardandoCeldas] = useState(new Set());
  const [mapaAbierto, setMapaAbierto] = useState(false);

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
        mapa[c.tarea_id][c.fecha] = c.zona;
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

  const guardarCelda = async (tareaId, fecha, valor) => {
    if (!parteAbierto) return;
    const key = `${tareaId}|${fecha}`;
    setGuardandoCeldas((prev) => new Set(prev).add(key));

    const anterior = celdas[tareaId]?.[fecha];
    // Actualizacion optimista
    setCeldas((prev) => {
      const copia = { ...prev, [tareaId]: { ...(prev[tareaId] || {}) } };
      if (valor) copia[tareaId][fecha] = valor;
      else delete copia[tareaId][fecha];
      return copia;
    });

    try {
      await axios.put(`${API}/work-orders/${id}/rejilla-zonas/celda`, {
        tarea_id: tareaId,
        fecha,
        zona: valor || null,
      });
    } catch (err) {
      console.error("Error guardando celda:", err);
      toast.error("No se pudo guardar. Se revierte el cambio.");
      // Revertir al valor anterior
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
            <p className="text-sm text-slate-500">{parte.titulo}</p>
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
        Clica una celda y elige la zona (A-M) donde se hizo esa tarea ese día, o "X" si no
        aplica una zona concreta. Deja en blanco si no se hizo.
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
                  className="bg-slate-50 border-b border-slate-200 px-1 py-1 text-center font-medium text-slate-500 w-11"
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
                  const valor = celdas[t.tarea_id]?.[fecha] || "";
                  const key = `${t.tarea_id}|${fecha}`;
                  const guardando = guardandoCeldas.has(key);
                  return (
                    <td key={fecha} className="border-l border-slate-100 p-0 text-center">
                      <select
                        value={valor}
                        disabled={!parteAbierto || guardando}
                        onChange={(e) => guardarCelda(t.tarea_id, fecha, e.target.value)}
                        className={`w-11 h-7 text-center text-[11px] border-0 bg-transparent focus:ring-1 focus:ring-inset focus:ring-indigo-400 cursor-pointer disabled:cursor-not-allowed ${
                          valor ? "font-semibold text-indigo-700" : "text-slate-300"
                        }`}
                        data-testid={`celda-${t.tarea_id}-${fecha}`}
                      >
                        <option value=""> </option>
                        <option value="X">X</option>
                        {ZONA_LETRAS.map((letra) => (
                          <option key={letra} value={letra}>
                            {letra}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
