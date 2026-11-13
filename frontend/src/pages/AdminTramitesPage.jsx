import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ScrollText, Plus, Trash2, ArrowLeft, Upload, FileText, ExternalLink, Phone, Mail, Pencil, Check, ArrowUp, ArrowDown, Copy, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { comprimirImagen } from "@/lib/imagen";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "");
const ESTADOS = { en_curso: "En curso", concedida: "Concedida", cerrada: "Cerrada" };
const err = (e, d) => e.response?.data?.detail || d;
const leerArchivo = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

/* ---------------- Detalle de un expediente ---------------- */
const Expediente = ({ id, onVolver }) => {
  const [e, setE] = useState(null);
  const [nuevoPaso, setNuevoPaso] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef(null);
  const pasoDoc = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setE((await axios.get(`${API}/admin/tramites/expedientes/${id}`)).data);
    } catch {
      toast.error("No se pudo abrir el expediente");
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const actPaso = async (pasoId, body) => {
    try {
      setE((await axios.put(`${API}/admin/tramites/expedientes/${id}/pasos/${pasoId}`, body)).data);
    } catch (x) { toast.error(err(x, "No se pudo guardar")); }
  };
  const guardarCampo = async (body) => {
    try {
      setE((await axios.put(`${API}/admin/tramites/expedientes/${id}`, body)).data);
    } catch (x) { toast.error(err(x, "No se pudo guardar")); }
  };
  const subir = async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    setSubiendo(true);
    try {
      const archivo = f.type === "application/pdf" ? await leerArchivo(f) : await comprimirImagen(f);
      const r = await axios.post(`${API}/admin/tramites/expedientes/${id}/documentos`, {
        archivo, nombre: f.name, paso_id: pasoDoc.current,
      });
      setE(r.data);
      toast.success("Documento subido");
    } catch (x) { toast.error(err(x, "No se pudo subir")); }
    finally { setSubiendo(false); }
  };
  const quitarDoc = async (d) => {
    if (!window.confirm(`¿Borrar «${d.nombre}»?`)) return;
    try {
      setE((await axios.delete(`${API}/admin/tramites/expedientes/${id}/documentos/${d.id}`)).data);
    } catch { toast.error("No se pudo borrar"); }
  };
  const anadirPaso = async () => {
    if (!nuevoPaso.trim()) return;
    try {
      setE((await axios.post(`${API}/admin/tramites/expedientes/${id}/pasos`, { titulo: nuevoPaso.trim() })).data);
      setNuevoPaso("");
    } catch (x) { toast.error(err(x, "No se pudo añadir")); }
  };
  const mover = async (i, d) => {
    const ids = e.pasos.map((p) => p.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { setE((await axios.post(`${API}/admin/tramites/expedientes/${id}/pasos/orden`, { ids })).data); }
    catch { toast.error("No se pudo reordenar"); }
  };
  const quitarPaso = async (p) => {
    if (!window.confirm(`¿Quitar el paso «${p.titulo}»?`)) return;
    try { setE((await axios.delete(`${API}/admin/tramites/expedientes/${id}/pasos/${p.id}`)).data); }
    catch { toast.error("No se pudo quitar"); }
  };
  const editarPaso = async (p) => {
    const titulo = window.prompt("Título del paso", p.titulo);
    if (titulo === null || !titulo.trim()) return;
    const detalle = window.prompt("Detalle (opcional)", p.detalle || "");
    if (detalle === null) return;
    actPaso(p.id, { titulo: titulo.trim(), detalle });
  };
  // Añade un paso nuevo y lo coloca justo después de `despuesDe` (índice) o al final.
  const anadirEn = async (despuesDe) => {
    const titulo = window.prompt("Nuevo paso");
    if (!titulo || !titulo.trim()) return;
    try {
      let r = (await axios.post(`${API}/admin/tramites/expedientes/${id}/pasos`, { titulo: titulo.trim() })).data;
      const ids = r.pasos.map((p) => p.id);
      const nuevo = ids.pop();
      ids.splice(despuesDe + 1, 0, nuevo);
      r = (await axios.post(`${API}/admin/tramites/expedientes/${id}/pasos/orden`, { ids })).data;
      setE(r);
    } catch (x) { toast.error(err(x, "No se pudo añadir")); }
  };
  const borrar = async () => {
    if (!window.confirm("¿Borrar este expediente y sus documentos?")) return;
    try { await axios.delete(`${API}/admin/tramites/expedientes/${id}`); onVolver(); }
    catch { toast.error("No se pudo borrar"); }
  };

  if (!e) return <p className="text-slate-400 p-6">Cargando…</p>;
  const hechos = e.pasos.filter((p) => p.hecho).length;
  const docsDe = (pid) => e.documentos.filter((d) => d.paso_id === pid);
  const sueltos = e.documentos.filter((d) => !e.pasos.some((p) => p.id === d.paso_id));

  const DocLinea = ({ d }) => (
    <div className="flex items-center gap-2 text-sm">
      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
      <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{d.nombre}</a>
      <button onClick={() => quitarDoc(d)} className="text-slate-300 hover:text-red-500 ml-auto" title="Borrar"><Trash2 className="w-4 h-4" /></button>
    </div>
  );

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={subir} />
      <button onClick={onVolver} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <Card className="border-slate-100 mb-4">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">{e.tipo}</p>
          <Input defaultValue={e.titulo} onBlur={(x) => x.target.value !== e.titulo && guardarCampo({ titulo: x.target.value })} className="font-semibold" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Cliente</Label><Input defaultValue={e.cliente} onBlur={(x) => x.target.value !== e.cliente && guardarCampo({ cliente: x.target.value })} /></div>
            <div><Label>Dirección</Label><Input defaultValue={e.direccion} onBlur={(x) => x.target.value !== e.direccion && guardarCampo({ direccion: x.target.value })} /></div>
          </div>
          <div>
            <Label>Notas (nº de registro, expediente, contacto...)</Label>
            <Textarea defaultValue={e.notas} rows={2} onBlur={(x) => x.target.value !== e.notas && guardarCampo({ notas: x.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={e.estado} onChange={(x) => guardarCampo({ estado: x.target.value })} className="border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white">
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-sm text-slate-500">{hechos}/{e.pasos.length} pasos</span>
            {e.plataforma && <span className="text-xs text-slate-500 flex items-start gap-1"><ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" />{e.plataforma}</span>}
            <Button variant="ghost" size="sm" className="ml-auto text-red-500" onClick={borrar}><Trash2 className="w-4 h-4 mr-1" />Borrar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {e.pasos.map((p, i) => (
          <Card key={p.id} className={`border-slate-100 ${p.hecho ? "bg-emerald-50/50" : ""}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex gap-3">
                <Checkbox checked={!!p.hecho} onCheckedChange={(v) => actPaso(p.id, { hecho: !!v })} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${p.hecho ? "line-through text-slate-400" : "text-slate-900"}`}>{i + 1}. {p.titulo}</p>
                  {p.detalle && <p className="text-xs text-slate-500 mt-0.5">{p.detalle}</p>}
                  {p.hecho && p.fecha_hecho && <p className="text-xs text-emerald-600 mt-0.5">Hecho el {fmt(p.fecha_hecho)}</p>}
                </div>
                <div className="flex flex-col">
                  <button disabled={i === 0} onClick={() => mover(i, -1)} className="text-slate-400 hover:text-slate-800 disabled:opacity-20" title="Subir"><ArrowUp className="w-4 h-4" /></button>
                  <button disabled={i === e.pasos.length - 1} onClick={() => mover(i, 1)} className="text-slate-400 hover:text-slate-800 disabled:opacity-20" title="Bajar"><ArrowDown className="w-4 h-4" /></button>
                </div>
                <button onClick={() => editarPaso(p)} className="text-slate-400 hover:text-slate-800" title="Editar paso"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => quitarPaso(p)} className="text-slate-300 hover:text-red-500" title="Quitar paso"><Trash2 className="w-4 h-4" /></button>
                <Button variant="ghost" size="sm" disabled={subiendo} title="Subir documento a este paso"
                  onClick={() => { pasoDoc.current = p.id; fileRef.current?.click(); }}>
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              {docsDe(p.id).map((d) => <DocLinea key={d.id} d={d} />)}
              <button onClick={() => anadirEn(i)} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3" />Añadir un paso después de este</button>
              <Input defaultValue={p.nota} placeholder="Nota de este paso…" className="h-8 text-sm"
                onBlur={(x) => x.target.value !== (p.nota || "") && actPaso(p.id, { nota: x.target.value })} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Input value={nuevoPaso} onChange={(x) => setNuevoPaso(x.target.value)} placeholder="Añadir un paso extra…" onKeyDown={(x) => x.key === "Enter" && anadirPaso()} />
        <Button variant="outline" onClick={anadirPaso}><Plus className="w-4 h-4" /></Button>
      </div>

      <Card className="border-slate-100 mt-4">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Documentación general</p>
            <Button variant="outline" size="sm" disabled={subiendo} onClick={() => { pasoDoc.current = null; fileRef.current?.click(); }}>
              <Upload className="w-4 h-4 mr-1" />{subiendo ? "Subiendo…" : "Subir"}
            </Button>
          </div>
          {sueltos.length === 0 && <p className="text-xs text-slate-400">PDF o foto (justificantes, resolución, informe…)</p>}
          {sueltos.map((d) => <DocLinea key={d.id} d={d} />)}
        </CardContent>
      </Card>
    </div>
  );
};

/* ---------------- Lista + nuevo expediente ---------------- */
const Expedientes = ({ plantillas, abrir }) => {
  const [lista, setLista] = useState([]);
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState({ plantilla_id: "", titulo: "", cliente: "", direccion: "" });

  const cargar = useCallback(async () => {
    try { setLista((await axios.get(`${API}/admin/tramites/expedientes`)).data); } catch { /* */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!f.plantilla_id || !f.titulo.trim()) return toast.error("Elige el tipo y pon un título");
    try {
      const r = await axios.post(`${API}/admin/tramites/expedientes`, f);
      setNuevo(false); setF({ plantilla_id: "", titulo: "", cliente: "", direccion: "" });
      abrir(r.data.id);
    } catch (x) { toast.error(err(x, "No se pudo crear")); }
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => setNuevo(!nuevo)}><Plus className="w-4 h-4 mr-1" />Nuevo expediente</Button>
      {nuevo && (
        <Card className="border-slate-100"><CardContent className="p-4 space-y-3">
          <div>
            <Label>Tipo de trámite</Label>
            <select value={f.plantilla_id} onChange={(x) => setF({ ...f, plantilla_id: x.target.value })} className="w-full border border-slate-200 rounded-md px-2 py-2 text-sm bg-white">
              <option value="">— elige —</option>
              {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div><Label>Título</Label><Input value={f.titulo} onChange={(x) => setF({ ...f, titulo: x.target.value })} placeholder="Ej. Tala 3 pinos – C/ Mayor 5" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Cliente</Label><Input value={f.cliente} onChange={(x) => setF({ ...f, cliente: x.target.value })} /></div>
            <div><Label>Dirección</Label><Input value={f.direccion} onChange={(x) => setF({ ...f, direccion: x.target.value })} /></div>
          </div>
          <Button onClick={crear}>Crear con sus pasos</Button>
        </CardContent></Card>
      )}
      {lista.length === 0 && <p className="text-sm text-slate-400">Aún no hay expedientes.</p>}
      {lista.map((x) => (
        <Card key={x.id} className="border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => abrir(x.id)}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate">{x.titulo}</p>
              <p className="text-xs text-slate-500 truncate">{x.tipo}{x.cliente ? ` · ${x.cliente}` : ""}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium">{x.pasos_hechos}/{x.pasos_total}</p>
              <p className="text-xs text-slate-400">{ESTADOS[x.estado] || x.estado}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/* ---------------- Protocolos (plantillas) ---------------- */
const Protocolos = ({ plantillas, recargar }) => {
  const [edit, setEdit] = useState(null);
  const setPaso = (i, campo, v) => setEdit((ed) => ({ ...ed, pasos: ed.pasos.map((p, k) => (k === i ? { ...p, [campo]: v } : p)) }));
  const mover = (i, d) => setEdit((ed) => {
    const j = i + d;
    if (j < 0 || j >= ed.pasos.length) return ed;
    const a = [...ed.pasos];
    [a[i], a[j]] = [a[j], a[i]];
    return { ...ed, pasos: a };
  });
  const quitar = (i) => setEdit((ed) => ({ ...ed, pasos: ed.pasos.filter((_, k) => k !== i) }));
  const insertar = (i) => setEdit((ed) => {
    const a = [...ed.pasos];
    a.splice(i + 1, 0, { titulo: "", detalle: "" });
    return { ...ed, pasos: a };
  });
  const guardar = async () => {
    const pasos = edit.pasos.filter((p) => p.titulo.trim()).map((p) => ({ titulo: p.titulo.trim(), detalle: p.detalle || "" }));
    const body = { nombre: edit.nombre, descripcion: edit.descripcion || "", plataforma: edit.plataforma || "", pasos };
    if (!body.nombre.trim()) return toast.error("Pon un nombre");
    try {
      if (edit.id) await axios.put(`${API}/admin/tramites/plantillas/${edit.id}`, body);
      else await axios.post(`${API}/admin/tramites/plantillas`, body);
      setEdit(null); recargar();
    } catch (x) { toast.error(err(x, "No se pudo guardar")); }
  };
  const borrar = async (p) => {
    if (!window.confirm(`¿Borrar el protocolo «${p.nombre}»? Los expedientes ya creados no se pierden.`)) return;
    await axios.delete(`${API}/admin/tramites/plantillas/${p.id}`); recargar();
  };
  const abrir = (p, copia) => setEdit({
    id: copia ? undefined : p.id,
    nombre: copia ? `${p.nombre} (copia)` : p.nombre,
    descripcion: p.descripcion || "", plataforma: p.plataforma || "",
    pasos: p.pasos.map((s) => ({ titulo: s.titulo, detalle: s.detalle || "" })),
  });
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Pasos recopilados de la web oficial del Ayuntamiento de Madrid. Confirma siempre en la sede antes de presentar. Edita, reordena, añade o duplica un protocolo para otro ayuntamiento.</p>
      <Button variant="outline" onClick={() => setEdit({ nombre: "", descripcion: "", plataforma: "", pasos: [{ titulo: "", detalle: "" }] })}><Plus className="w-4 h-4 mr-1" />Nuevo protocolo</Button>
      {edit && (
        <Card className="border-amber-200"><CardContent className="p-4 space-y-3">
          <div><Label>Nombre</Label><Input value={edit.nombre} onChange={(x) => setEdit({ ...edit, nombre: x.target.value })} /></div>
          <div><Label>Descripción</Label><Textarea rows={2} value={edit.descripcion} onChange={(x) => setEdit({ ...edit, descripcion: x.target.value })} /></div>
          <div><Label>Plataforma / dirección donde se presenta</Label><Input value={edit.plataforma} onChange={(x) => setEdit({ ...edit, plataforma: x.target.value })} /></div>
          <div className="space-y-2">
            <Label>Pasos (en orden)</Label>
            {edit.pasos.map((p, i) => (
              <div key={i} className="border border-slate-200 rounded-md p-2 space-y-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-400 w-6">{i + 1}.</span>
                  <Input value={p.titulo} onChange={(x) => setPaso(i, "titulo", x.target.value)} placeholder="Título del paso" className="h-8" />
                  <button disabled={i === 0} onClick={() => mover(i, -1)} className="text-slate-400 hover:text-slate-800 disabled:opacity-20"><ArrowUp className="w-4 h-4" /></button>
                  <button disabled={i === edit.pasos.length - 1} onClick={() => mover(i, 1)} className="text-slate-400 hover:text-slate-800 disabled:opacity-20"><ArrowDown className="w-4 h-4" /></button>
                  <button onClick={() => quitar(i)} className="text-slate-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
                <Textarea rows={2} value={p.detalle} onChange={(x) => setPaso(i, "detalle", x.target.value)} placeholder="Detalle (opcional)" className="text-sm" />
                <button onClick={() => insertar(i)} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3" />Añadir un paso después</button>
              </div>
            ))}
            {edit.pasos.length === 0 && <Button variant="outline" size="sm" onClick={() => insertar(-1)}><Plus className="w-4 h-4 mr-1" />Añadir paso</Button>}
          </div>
          <div className="flex gap-2"><Button onClick={guardar}><Check className="w-4 h-4 mr-1" />Guardar</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
          {edit.id && <p className="text-xs text-slate-400">Los cambios afectan a expedientes nuevos. Los ya creados se editan dentro de cada expediente.</p>}
        </CardContent></Card>
      )}
      {plantillas.map((p) => (
        <Card key={p.id} className="border-slate-100"><CardContent className="p-4">
          <div className="flex items-start gap-1">
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{p.nombre}</p>
              {p.descripcion && <p className="text-xs text-slate-500 mt-1">{p.descripcion}</p>}
              {p.plataforma && <p className="text-xs text-blue-700 mt-1 break-words">📍 {p.plataforma}</p>}
            </div>
            <Button variant="ghost" size="sm" title="Editar" onClick={() => abrir(p, false)}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" title="Duplicar para otro ayuntamiento" onClick={() => abrir(p, true)}><Copy className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => borrar(p)}><Trash2 className="w-4 h-4" /></Button>
          </div>
          <ol className="mt-3 space-y-1.5 list-decimal list-inside text-sm text-slate-700">
            {p.pasos.map((st) => (
              <li key={st.id}><span className="font-medium">{st.titulo}</span>{st.detalle && <span className="block ml-5 text-xs text-slate-500">{st.detalle}</span>}</li>
            ))}
          </ol>
        </CardContent></Card>
      ))}
    </div>
  );
};

/* ---------------- Contactos ---------------- */
const Contactos = () => {
  const [lista, setLista] = useState([]);
  const [edit, setEdit] = useState(null);
  const cargar = useCallback(async () => {
    try { setLista((await axios.get(`${API}/admin/tramites/contactos`)).data); } catch { /* */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const guardar = async () => {
    if (!edit.organismo.trim()) return toast.error("Pon el nombre del organismo");
    const { id, created_at, ...body } = edit;
    try {
      if (id) await axios.put(`${API}/admin/tramites/contactos/${id}`, body);
      else await axios.post(`${API}/admin/tramites/contactos`, body);
      setEdit(null); cargar();
    } catch (x) { toast.error(err(x, "No se pudo guardar")); }
  };
  const borrar = async (c) => {
    if (!window.confirm(`¿Borrar «${c.organismo}»?`)) return;
    await axios.delete(`${API}/admin/tramites/contactos/${c.id}`); cargar();
  };
  const vacio = { organismo: "", telefono: "", email: "", web: "", notas: "" };
  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={() => setEdit(vacio)}><Plus className="w-4 h-4 mr-1" />Nuevo contacto</Button>
      {edit && (
        <Card className="border-slate-100"><CardContent className="p-4 space-y-3">
          <div><Label>Organismo / ayuntamiento / persona</Label><Input value={edit.organismo} onChange={(x) => setEdit({ ...edit, organismo: x.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Teléfono</Label><Input value={edit.telefono} onChange={(x) => setEdit({ ...edit, telefono: x.target.value })} /></div>
            <div><Label>Email</Label><Input value={edit.email} onChange={(x) => setEdit({ ...edit, email: x.target.value })} /></div>
          </div>
          <div><Label>Web</Label><Input value={edit.web} onChange={(x) => setEdit({ ...edit, web: x.target.value })} /></div>
          <div><Label>Notas</Label><Textarea rows={2} value={edit.notas} onChange={(x) => setEdit({ ...edit, notas: x.target.value })} /></div>
          <div className="flex gap-2"><Button onClick={guardar}>Guardar</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
        </CardContent></Card>
      )}
      {lista.map((c) => (
        <Card key={c.id} className="border-slate-100"><CardContent className="p-3 flex gap-2">
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="font-medium text-slate-900">{c.organismo}</p>
            {c.telefono && <a href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`} className="text-sm text-blue-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{c.telefono}</a>}
            {c.email && <a href={`mailto:${c.email}`} className="text-sm text-blue-600 flex items-center gap-1 break-all"><Mail className="w-3.5 h-3.5" />{c.email}</a>}
            {c.web && <a href={c.web} target="_blank" rel="noreferrer" className="text-sm text-blue-600 flex items-center gap-1 break-all"><ExternalLink className="w-3.5 h-3.5" />{c.web}</a>}
            {c.notas && <p className="text-xs text-slate-500">{c.notas}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEdit(c)}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => borrar(c)}><Trash2 className="w-4 h-4" /></Button>
        </CardContent></Card>
      ))}
    </div>
  );
};

/* ---------------- Página ---------------- */
const AdminTramitesPage = () => {
  const [plantillas, setPlantillas] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const cargarPl = useCallback(async () => {
    try { setPlantillas((await axios.get(`${API}/admin/tramites/plantillas`)).data); } catch { /* */ }
  }, []);
  useEffect(() => { cargarPl(); }, [cargarPl]);

  return (
    <div data-testid="admin-tramites-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
          <ScrollText className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">Trámites y licencias</h1>
          <p className="text-sm text-slate-500">Talas, ocupación de vía pública… paso a paso</p>
        </div>
      </div>
      {abierto ? (
        <Expediente id={abierto} onVolver={() => setAbierto(null)} />
      ) : (
        <Tabs defaultValue="exp">
          <TabsList className="mb-4">
            <TabsTrigger value="exp">Expedientes</TabsTrigger>
            <TabsTrigger value="pro">Protocolos</TabsTrigger>
            <TabsTrigger value="con">Contactos</TabsTrigger>
          </TabsList>
          <TabsContent value="exp"><Expedientes plantillas={plantillas} abrir={setAbierto} /></TabsContent>
          <TabsContent value="pro"><Protocolos plantillas={plantillas} recargar={cargarPl} /></TabsContent>
          <TabsContent value="con"><Contactos /></TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AdminTramitesPage;
