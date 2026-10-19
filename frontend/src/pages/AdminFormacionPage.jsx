import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { GraduationCap, CalendarClock, Trash2, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURSOS_SUGERIDOS } from "@/components/FormacionUsuario";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (f) => (f ? f.split("-").reverse().join("/") : "");

const AdminFormacionPage = () => {
  const [operarios, setOperarios] = useState([]);
  const [convs, setConvs] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [busca, setBusca] = useState("");
  const [curso, setCurso] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([
        axios.get(`${API}/users/operarios`),
        axios.get(`${API}/admin/formacion/convocatorias`),
      ]);
      setOperarios(o.data);
      setConvs(c.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(
    () => operarios.filter((o) => (o.name || "").toLowerCase().includes(busca.toLowerCase())),
    [operarios, busca]
  );
  const todosMarcados = visibles.length > 0 && visibles.every((o) => sel.has(o.user_id));

  const alternar = (id) =>
    setSel((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const alternarTodos = () =>
    setSel((p) => {
      const n = new Set(p);
      visibles.forEach((o) => (todosMarcados ? n.delete(o.user_id) : n.add(o.user_id)));
      return n;
    });

  const enviar = async () => {
    if (sel.size === 0) return toast.error("Marca al menos un operario");
    if (!curso.trim() || !fecha) return toast.error("Pon el curso y la fecha");
    setEnviando(true);
    try {
      const res = await axios.post(`${API}/admin/formacion/convocatorias`, {
        curso: curso.trim(), fecha, hora, lugar: lugar.trim(), notas: notas.trim(), user_ids: [...sel],
      });
      toast.success(`Convocatoria enviada a ${res.data.creadas.length} operario(s)`);
      setSel(new Set()); setCurso(""); setFecha(""); setHora(""); setLugar(""); setNotas("");
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo convocar");
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async (c) => {
    if (!window.confirm(`¿Cancelar la convocatoria de ${c.operario_nombre} a «${c.curso}»? Se le avisará.`)) return;
    try {
      await axios.delete(`${API}/admin/formacion/convocatorias/${c.id}`);
      cargar();
    } catch {
      toast.error("No se pudo cancelar");
    }
  };

  // Agrupa por curso+fecha+hora+lugar
  const grupos = useMemo(() => {
    const m = new Map();
    convs.forEach((c) => {
      const k = [c.curso, c.fecha, c.hora, c.lugar].join("|");
      if (!m.has(k)) m.set(k, { ...c, items: [] });
      m.get(k).items.push(c);
    });
    return [...m.values()];
  }, [convs]);

  return (
    <div data-testid="admin-formacion-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">Formación</h1>
          <p className="text-sm text-slate-500">Convoca a varios operarios a un curso a la vez</p>
        </div>
      </div>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Nueva convocatoria
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="af-curso">Curso</Label>
              <Input id="af-curso" list="af-cursos" value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ej. Curso de trabajos en altura" />
              <datalist id="af-cursos">{CURSOS_SUGERIDOS.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-fecha">Fecha</Label>
              <Input id="af-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-hora">Hora</Label>
              <Input id="af-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="af-lugar">Lugar</Label>
              <Input id="af-lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Dirección o centro de formación" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="af-notas">Notas (opcional)</Label>
              <Input id="af-notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Traer DNI y calzado de seguridad" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Operarios ({sel.size} marcados)</Label>
              <div className="flex items-center gap-2">
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="h-8 w-40" />
                <Button variant="outline" size="sm" className="h-8" onClick={alternarTodos}>
                  {todosMarcados ? "Quitar todos" : "Marcar todos"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-72 overflow-y-auto border border-slate-100 rounded-lg p-2">
              {visibles.map((o) => (
                <label key={o.user_id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={sel.has(o.user_id)} onChange={() => alternar(o.user_id)} className="w-4 h-4" />
                  {o.name}
                </label>
              ))}
              {visibles.length === 0 && <p className="text-sm text-slate-400 p-2">Sin resultados.</p>}
            </div>
          </div>

          <Button onClick={enviar} disabled={enviando} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Send className="w-4 h-4 mr-2" />
            {enviando ? "Enviando..." : `Convocar y avisar${sel.size ? ` (${sel.size})` : ""}`}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-100">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Próximas convocatorias</p>
          {grupos.length === 0 ? (
            <p className="text-sm text-slate-400">No hay cursos convocados.</p>
          ) : (
            grupos.map((g) => (
              <div key={[g.curso, g.fecha, g.hora, g.lugar].join("|")} className="border border-slate-100 rounded-lg p-3">
                <p className="font-medium text-slate-900 text-sm">{g.curso}</p>
                <p className="text-xs text-slate-500 mb-2">
                  {fmt(g.fecha)}{g.hora ? ` · ${g.hora}` : ""}{g.lugar ? ` · ${g.lugar}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 bg-slate-100 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-slate-700">
                      {c.operario_nombre}
                      <button type="button" onClick={() => cancelar(c)} title="Quitar y avisar" className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFormacionPage;
