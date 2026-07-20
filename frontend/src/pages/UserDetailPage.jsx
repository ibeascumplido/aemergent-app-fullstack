import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, AlertTriangle, CheckCircle, Camera } from "lucide-react";
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
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [form, setForm] = useState(null);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/admin/users/${userId}`);
      setUsuario(res.data);
      setForm({
        role: res.data.role || "user",
        puesto: res.data.puesto || "",
        fechaUltima: res.data.fecha_ultima_revision_medica || "",
        fechaProxima: res.data.fecha_proxima_revision_medica || "",
        telefono: res.data.telefono || "",
        dni: res.data.dni || "",
        direccion: res.data.direccion || "",
        fechaNacimiento: res.data.fecha_nacimiento || "",
        contactoNombre: res.data.contacto_emergencia_nombre || "",
        contactoTelefono: res.data.contacto_emergencia_telefono || "",
      });
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

  const subirFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoFoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await axios.post(`${API}/admin/users/${userId}/foto`, { imagen: reader.result });
        toast.success("Foto actualizada");
        await cargar();
      } catch (err) {
        console.error("Error subiendo foto:", err);
        toast.error("No se pudo subir la foto");
      } finally {
        setSubiendoFoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await axios.put(`${API}/admin/users/${userId}`, {
        role: form.role,
        puesto: form.puesto.trim(),
        fecha_ultima_revision_medica: form.fechaUltima || null,
        fecha_proxima_revision_medica: form.fechaProxima || null,
        telefono: form.telefono.trim(),
        dni: form.dni.trim(),
        direccion: form.direccion.trim(),
        fecha_nacimiento: form.fechaNacimiento || null,
        contacto_emergencia_nombre: form.contactoNombre.trim(),
        contacto_emergencia_telefono: form.contactoTelefono.trim(),
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

  if (loading || !form) {
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

  const estadoRevision = calcularEstadoRevision(form.fechaProxima);

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

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <label
          className={`relative group w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 cursor-pointer overflow-hidden ${
            subiendoFoto ? "opacity-60" : ""
          }`}
          style={{ backgroundColor: usuario.color || "#3B82F6" }}
          data-testid="foto-usuario-label"
        >
          <input type="file" accept="image/*" onChange={subirFoto} disabled={subiendoFoto} className="hidden" />
          {usuario.picture ? (
            <img src={usuario.picture} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            usuario.abreviatura || usuario.name?.slice(0, 2).toUpperCase()
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </label>
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
            Rol y puesto
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rol (permisos)</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="rol-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="facturacion">Facturación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Puesto</Label>
              <Input
                value={form.puesto}
                onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))}
                placeholder="Ej. Operario, Encargado, Gerente..."
                data-testid="puesto-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Datos personales y de contacto
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                data-testid="telefono-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>DNI / NIE</Label>
              <Input
                value={form.dni}
                onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                data-testid="dni-input"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Dirección</Label>
              <Input
                value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                data-testid="direccion-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de nacimiento</Label>
              <Input
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Contacto de emergencia
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.contactoNombre}
                onChange={(e) => setForm((f) => ({ ...f, contactoNombre: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={form.contactoTelefono}
                onChange={(e) => setForm((f) => ({ ...f, contactoTelefono: e.target.value }))}
              />
            </div>
          </div>
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
                value={form.fechaUltima}
                onChange={(e) => setForm((f) => ({ ...f, fechaUltima: e.target.value }))}
                data-testid="fecha-ultima-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha-proxima">Próxima revisión</Label>
              <Input
                id="fecha-proxima"
                type="date"
                value={form.fechaProxima}
                onChange={(e) => setForm((f) => ({ ...f, fechaProxima: e.target.value }))}
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
