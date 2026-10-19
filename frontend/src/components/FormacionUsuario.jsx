import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { GraduationCap, FileText, Trash2, Plus, ExternalLink, CalendarClock, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { comprimirImagen } from "@/lib/imagen";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CURSOS_SUGERIDOS = [
  "Carnet de fitosanitarios",
  "Curso de trabajos en altura",
  "Manejo de plataformas elevadoras",
  "Curso de poda",
  "Prevención de riesgos laborales",
  "Manejo de motosierra",
  "Primeros auxilios",
];

export const estadoCaducidad = (fecha) => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(fecha + "T00:00:00") - hoy) / 86400000);
  if (dias < 0) return { color: "bg-red-100 text-red-700", texto: `Caducado hace ${-dias} día(s)` };
  if (dias <= 60) return { color: "bg-amber-100 text-amber-700", texto: `Caduca en ${dias} día(s)` };
  return { color: "bg-green-100 text-green-700", texto: `Vigente (caduca ${fecha.split("-").reverse().join("/")})` };
};

const fmt = (f) => (f ? f.split("-").reverse().join("/") : "");

const leerArchivo = (file) =>
  file.type.startsWith("image/")
    ? comprimirImagen(file)
    : new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

const FormacionUsuario = ({ userId }) => {
  const [docs, setDocs] = useState([]);
  const [convs, setConvs] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [realizacion, setRealizacion] = useState("");
  const [caducidad, setCaducidad] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef(null);

  const [curso, setCurso] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/users/${userId}/formacion`);
      setDocs(res.data.documentos);
      setConvs(res.data.convocatorias);
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  useEffect(() => { cargar(); }, [cargar]);

  const subir = async () => {
    if (!titulo.trim()) return toast.error("Pon el nombre del curso o carnet");
    if (!archivo) return toast.error("Elige un PDF o una imagen");
    setSubiendo(true);
    try {
      const data = await leerArchivo(archivo);
      await axios.post(`${API}/admin/users/${userId}/formacion`, {
        titulo: titulo.trim(),
        archivo: data,
        fecha_realizacion: realizacion || null,
        fecha_caducidad: caducidad || null,
      });
      toast.success("Documento guardado");
      setTitulo(""); setRealizacion(""); setCaducidad(""); setArchivo(null);
      if (fileRef.current) fileRef.current.value = "";
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo subir el documento");
    } finally {
      setSubiendo(false);
    }
  };

  const cambiarCaducidad = async (d, valor) => {
    try {
      await axios.put(`${API}/admin/formacion/${d.id}`, { fecha_caducidad: valor || null });
      toast.success("Caducidad actualizada");
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo actualizar");
    }
  };

  const borrar = async (d) => {
    if (!window.confirm(`¿Borrar «${d.titulo}»?`)) return;
    try {
      await axios.delete(`${API}/admin/formacion/${d.id}`);
      cargar();
    } catch (e) {
      toast.error("No se pudo borrar");
    }
  };

  const convocar = async () => {
    if (!curso.trim() || !fecha) return toast.error("Pon el curso y la fecha");
    setEnviando(true);
    try {
      await axios.post(`${API}/admin/formacion/convocatorias`, {
        curso: curso.trim(), fecha, hora, lugar: lugar.trim(), user_ids: [userId],
      });
      toast.success("Convocatoria creada y notificada al operario");
      setCurso(""); setFecha(""); setHora(""); setLugar("");
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo convocar");
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async (c) => {
    if (!window.confirm(`¿Cancelar la convocatoria a «${c.curso}»? Se avisará al operario.`)) return;
    try {
      await axios.delete(`${API}/admin/formacion/convocatorias/${c.id}`);
      cargar();
    } catch (e) {
      toast.error("No se pudo cancelar");
    }
  };

  return (
    <>
      <Card className="border-slate-100 mb-6" data-testid="formacion-docs">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> Formación y carnets
          </p>

          {docs.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay documentos.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {docs.map((d) => {
                const est = estadoCaducidad(d.fecha_caducidad);
                return (
                  <li key={d.id} className="p-3 flex items-start gap-3 flex-wrap">
                    <FileText className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-medium text-slate-900 text-sm">{d.titulo}</p>
                      {d.fecha_realizacion && (
                        <p className="text-xs text-slate-500">Realizado el {fmt(d.fecha_realizacion)}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {est && <span className={`text-xs rounded-full px-2 py-0.5 ${est.color}`}>{est.texto}</span>}
                        <label className="text-xs text-slate-500 flex items-center gap-1">
                          Caduca:
                          <input
                            type="date"
                            defaultValue={d.fecha_caducidad || ""}
                            onBlur={(e) => e.target.value !== (d.fecha_caducidad || "") && cambiarCaducidad(d, e.target.value)}
                            className="border border-slate-200 rounded px-1 py-0.5 text-xs"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={d.url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="h-8">
                          <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                        </Button>
                      </a>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" onClick={() => borrar(d)} title="Borrar">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border border-dashed border-slate-200 rounded-lg p-3 space-y-3">
            <p className="text-sm font-medium text-slate-700">Añadir documento</p>
            <div className="space-y-1.5">
              <Label htmlFor="form-titulo">Curso o carnet</Label>
              <Input id="form-titulo" list="cursos-sugeridos" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Carnet de fitosanitarios" />
              <datalist id="cursos-sugeridos">
                {CURSOS_SUGERIDOS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-real">Fecha de realización</Label>
                <Input id="form-real" type="date" value={realizacion} onChange={(e) => setRealizacion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-cad">Caduca (opcional)</Label>
                <Input id="form-cad" type="date" value={caducidad} onChange={(e) => setCaducidad(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-archivo">Archivo (PDF o imagen)</Label>
              <Input id="form-archivo" ref={fileRef} type="file" accept="application/pdf,image/*" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={subir} disabled={subiendo} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Upload className="w-4 h-4 mr-2" />
              {subiendo ? "Subiendo..." : "Guardar documento"}
            </Button>
            <p className="text-xs text-slate-400">
              Si pones fecha de caducidad, el operario (y tú) recibiréis aviso a los 2 meses, 1 mes, 1 semana, el día de caducidad y cuando ya haya vencido.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 mb-6" data-testid="formacion-convocatorias">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Convocar a un curso
          </p>

          {convs.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {convs.map((c) => (
                <li key={c.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{c.curso}</p>
                    <p className="text-xs text-slate-500">
                      {fmt(c.fecha)}{c.hora ? ` · ${c.hora}` : ""}{c.lugar ? ` · ${c.lugar}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" onClick={() => cancelar(c)} title="Cancelar convocatoria">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="conv-curso">Curso</Label>
              <Input id="conv-curso" list="cursos-sugeridos" value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ej. Manejo de plataformas elevadoras" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conv-fecha">Fecha</Label>
              <Input id="conv-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conv-hora">Hora</Label>
              <Input id="conv-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="conv-lugar">Lugar</Label>
              <Input id="conv-lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Dirección o centro de formación" />
            </div>
          </div>
          <Button onClick={convocar} disabled={enviando} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            {enviando ? "Enviando..." : "Convocar y avisar"}
          </Button>
          <p className="text-xs text-slate-400">
            Le llega una notificación al momento y un recordatorio el día antes.
          </p>
        </CardContent>
      </Card>
    </>
  );
};

export default FormacionUsuario;
