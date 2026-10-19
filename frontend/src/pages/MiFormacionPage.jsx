import { useEffect, useState } from "react";
import axios from "axios";
import { GraduationCap, FileText, ExternalLink, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { estadoCaducidad } from "@/components/FormacionUsuario";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (f) => (f ? f.split("-").reverse().join("/") : "");

const MiFormacionPage = () => {
  const [data, setData] = useState({ documentos: [], convocatorias: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/mi-formacion`)
      .then((r) => setData(r.data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando...</div>;

  return (
    <div data-testid="mi-formacion-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">Mi formación</h1>
          <p className="text-sm text-slate-500">Tus cursos, carnets y próximas convocatorias</p>
        </div>
      </div>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Próximos cursos
          </p>
          {data.convocatorias.length === 0 ? (
            <p className="text-sm text-slate-400">No tienes cursos convocados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.convocatorias.map((c) => (
                <li key={c.id} className="py-3">
                  <p className="font-medium text-slate-900">{c.curso}</p>
                  <p className="text-sm text-slate-500">
                    {fmt(c.fecha)}{c.hora ? ` a las ${c.hora}` : ""}{c.lugar ? ` · ${c.lugar}` : ""}
                  </p>
                  {c.notas && <p className="text-sm text-slate-500">{c.notas}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-100">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Mis cursos y carnets</p>
          {data.documentos.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay documentos en tu ficha.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.documentos.map((d) => {
                const est = estadoCaducidad(d.fecha_caducidad);
                return (
                  <li key={d.id} className="py-3 flex items-center gap-3 flex-wrap">
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-[160px]">
                      <p className="font-medium text-slate-900 text-sm">{d.titulo}</p>
                      {d.fecha_realizacion && <p className="text-xs text-slate-500">Realizado el {fmt(d.fecha_realizacion)}</p>}
                      {est && <span className={`text-xs rounded-full px-2 py-0.5 ${est.color}`}>{est.texto}</span>}
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="h-8">
                        <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                      </Button>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MiFormacionPage;
