import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Umbral para avisar de una revision medica proxima (dias antes de la fecha)
const DIAS_AVISO_PREVIO = 30;

const calcularEstadoRevision = (fechaProxima) => {
  if (!fechaProxima) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const proxima = new Date(fechaProxima + "T00:00:00");
  const diasRestantes = Math.round((proxima - hoy) / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return { tipo: "vencida", diasRestantes };
  if (diasRestantes <= DIAS_AVISO_PREVIO) return { tipo: "proxima", diasRestantes };
  return { tipo: "ok", diasRestantes };
};

const UserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [puesto, setPuesto] = useState("");
  const [fechaUltima, setFechaUltima] = useState("");
  const [fechaProxima, setFechaProxima] = useState("");

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/admin/users/${userId}`);
      setUsuario(res.data);
      setPuesto(res.data.puesto || "");
      setFechaUltima(res.data.fecha_ultima_revision_medica || "");
      setFechaProxima(res.data.fecha_proxima_revision_medica || "");
    } catch (err) {
      console.error("Error cargando ficha de usuario:", err);
      toast.error("No se pudo cargar la ficha");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await axios.put(`${API}/admin/users/${userId}`, {
        puesto: puesto.trim(),
        fecha_ultima_revision_medica: fechaUltima || null,
        fecha_proxima_revision_medica: fechaProxima || null,
      });
      toast.success("Ficha actualizada");
      await cargar();
    } catch (err) {
      console.error("Error guardando ficha:", err);
      toast.error("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const estadoRevision = calcularEstadoRevision(fechaProxima);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  if (!usuario) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("/admin/users")} className="mb-4" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">
            No se encontró este usuario.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="user-detail-page">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin/users")}
        className="mb-4 -ml-3"
        size="sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Usuarios
      </Button>

      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
          style={{ backgroundColor: usuario.color || "#3B82F6" }}
        >
          {usuario.picture ? (
            <img src={usuario.picture} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            usuario.abreviatura || usuario.name?.slice(0, 2).toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            {usuario.name}
          </h1>
          <p className="text-sm text-slate-500">{usuario.email}</p>
        </div>
        {estadoRevision?.tipo === "vencida" && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            Revisión médica vencida
          </span>
        )}
        {estadoRevision?.tipo === "proxima" && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            Revisión médica en {estadoRevision.diasRestantes} días
          </span>
        )}
        {estadoRevision?.tipo === "ok" && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle className="w-3.5 h-3.5" />
            Revisión médica al día
          </span>
        )}
      </div>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5" />
            Puesto
          </p>
          <Input
            value={puesto}
            onChange={(e) => setPuesto(e.target.value)}
            placeholder="Ej. Operario, Encargado, Gerente..."
            data-testid="puesto-input"
          />
        </CardContent>
      </Card>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Revisión médica
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fecha-ultima">Última revisión</Label>
              <Input
                id="fecha-ultima"
                type="date"
                value={fechaUltima}
                onChange={(e) => setFechaUltima(e.target.value)}
                data-testid="fecha-ultima-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha-proxima">Próxima revisión</Label>
              <Input
                id="fecha-proxima"
                type="date"
                value={fechaProxima}
                onChange={(e) => setFechaProxima(e.target.value)}
                data-testid="fecha-proxima-input"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Avisa aquí en la ficha cuando falten {DIAS_AVISO_PREVIO} días o menos para la
            próxima revisión, o si ya se ha pasado la fecha.
          </p>
        </CardContent>
      </Card>

      <Button
        onClick={guardar}
        disabled={guardando}
        className="bg-indigo-600 hover:bg-indigo-700 text-white"
        data-testid="guardar-ficha-btn"
      >
        {guardando ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
};

export default UserDetailPage;
