import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, MapPin, ExternalLink, Users, Download } from "lucide-react";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const hoyISO = () => new Date().toISOString().slice(0, 10);
const mesActualISO = () => new Date().toISOString().slice(0, 7);

const AdminFichajesPage = () => {
  const [fecha, setFecha] = useState(hoyISO());
  const [operarioId, setOperarioId] = useState("todos");
  const [operarios, setOperarios] = useState([]);
  const [fichajes, setFichajes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [operarioInforme, setOperarioInforme] = useState("");
  const [mesInforme, setMesInforme] = useState(mesActualISO());
  const [descargandoInforme, setDescargandoInforme] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/users/operarios`)
      .then((res) => {
        setOperarios(res.data);
        if (res.data.length > 0) setOperarioInforme(res.data[0].user_id);
      })
      .catch(() => setOperarios([]));
  }, []);

  const descargarInforme = async () => {
    if (!operarioInforme) {
      toast.error("Selecciona un operario");
      return;
    }
    setDescargandoInforme(true);
    try {
      const res = await axios.get(`${API}/admin/fichajes/pdf`, {
        params: { operario_id: operarioInforme, mes: mesInforme },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const nombreOperario = operarios.find((o) => o.user_id === operarioInforme)?.name || "operario";
      const a = document.createElement("a");
      a.href = url;
      a.download = `fichajes-${nombreOperario.replace(/\s+/g, "_")}-${mesInforme}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error descargando informe:", err);
      toast.error("No se pudo generar el informe");
    } finally {
      setDescargandoInforme(false);
    }
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { fecha };
      if (operarioId !== "todos") params.operario_id = operarioId;
      const res = await axios.get(`${API}/admin/fichajes`, { params });
      setFichajes(res.data);
    } catch (err) {
      console.error("Error cargando fichajes:", err);
      toast.error("No se pudieron cargar los fichajes");
    } finally {
      setLoading(false);
    }
  }, [fecha, operarioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div data-testid="admin-fichajes-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Clock className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Fichajes
          </h1>
          <p className="text-sm text-slate-500">Entradas y salidas del equipo, con ubicación</p>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm mb-4">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Informe mensual (PDF)
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5 min-w-[180px]">
              <Label>Operario</Label>
              <Select value={operarioInforme} onValueChange={setOperarioInforme}>
                <SelectTrigger data-testid="informe-operario-select">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {operarios.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mes</Label>
              <Input
                type="month"
                value={mesInforme}
                onChange={(e) => setMesInforme(e.target.value)}
                data-testid="informe-mes-input"
              />
            </div>
            <Button
              onClick={descargarInforme}
              disabled={descargandoInforme}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="descargar-informe-fichajes-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              {descargandoInforme ? "Generando..." : "Descargar PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div className="space-y-1.5">
          <Label>Día</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} data-testid="fichajes-fecha-input" />
        </div>
        <div className="space-y-1.5 min-w-[180px]">
          <Label>Operario</Label>
          <Select value={operarioId} onValueChange={setOperarioId}>
            <SelectTrigger data-testid="fichajes-operario-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {operarios.map((o) => (
                <SelectItem key={o.user_id} value={o.user_id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-4">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
          ) : fichajes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No hay fichajes para este día.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {fichajes.map((f) => {
                const esEntrada = f.tipo === "entrada";
                const Icon = esEntrada ? LogIn : LogOut;
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between py-2.5"
                    data-testid={`fichaje-${f.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          esEntrada ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {f.operario_nombre}
                        </p>
                        <p className="text-xs text-slate-500">
                          {esEntrada ? "Entrada" : "Salida"} · {f.destino_nombre}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-700 font-['JetBrains_Mono']">
                        {new Date(f.fecha_hora).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {f.latitud != null && f.longitud != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${f.latitud},${f.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 justify-end"
                        >
                          <MapPin className="w-3 h-3" />
                          Ver zona aprox.
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="text-xs text-slate-300">Sin ubicación</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFichajesPage;
