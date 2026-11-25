import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Store, Plus, Trash2, ArrowLeft, Upload, FileText, Phone, Mail, Globe, MapPin, Search, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { comprimirImagen } from "@/lib/imagen";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CATEGORIAS = [
  "Vivero", "Macetas y contenedores", "Plataformas elevadoras", "Maquinaria y herramienta",
  "Fitosanitarios y abonos", "Sustratos y áridos", "Riego", "Gestión de residuos",
  "Transporte", "EPIs y ropa", "Otros",
];
const err = (e, d) => e.response?.data?.detail || d;
const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const leer = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
const euros = (n) => (n == null || n === "" ? "" : Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR" }));
const vacioContacto = { nombre: "", cargo: "", telefono: "", email: "" };
const vacioProducto = { nombre: "", referencia: "", precio: "", unidad: "", fecha_tarifa: "", notas: "" };

/* ---------------- Ficha ---------------- */
const Ficha = ({ id, onVolver, onCambio }) => {
  const [p, setP] = useState(null);
  const [f, setF] = useState(null);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("tarifa");
  const [filtroProd, setFiltroProd] = useState("");
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const d = (await axios.get(`${API}/admin/proveedores/${id}`)).data;
      setP(d);
      setF({
        nombre: d.nombre, categoria: d.categoria || "", web: d.web || "", direccion: d.direccion || "",
        condiciones: d.condiciones || "", notas: d.notas || "",
        contactos: d.contactos || [], productos: (d.productos || []).map((x) => ({ ...x, precio: x.precio ?? "" })),
      });
      setSucio(false);
    } catch { toast.error("No se pudo abrir el proveedor"); }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const set = (campo, valor) => { setF((x) => ({ ...x, [campo]: valor })); setSucio(true); };
  const setFila = (lista, i, campo, valor) => set(lista, f[lista].map((x, k) => (k === i ? { ...x, [campo]: valor } : x)));
  const quitarFila = (lista, i) => set(lista, f[lista].filter((_, k) => k !== i));

  const guardar = async () => {
    if (!f.nombre.trim()) return toast.error("Pon el nombre del proveedor");
    setGuardando(true);
    try {
      const body = {
        ...f,
        contactos: f.contactos.filter((c) => c.nombre || c.telefono || c.email || c.cargo),
        productos: f.productos.filter((x) => x.nombre.trim()).map((x) => ({ ...x, precio: x.precio === "" ? null : Number(String(x.precio).replace(",", ".")) })),
      };
      if (body.productos.some((x) => x.precio != null && Number.isNaN(x.precio))) { setGuardando(false); return toast.error("Hay un precio que no es un número"); }
      await axios.put(`${API}/admin/proveedores/${id}`, body);
      toast.success("Guardado");
      await cargar();
      onCambio();
    } catch (e) { toast.error(err(e, "No se pudo guardar")); }
    finally { setGuardando(false); }
  };
  const subir = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setSubiendo(true);
    try {
      const archivo = file.type.startsWith("image/") ? await comprimirImagen(file) : await leer(file);
      const r = await axios.post(`${API}/admin/proveedores/${id}/documentos`, { archivo, nombre: file.name, tipo: tipoDoc });
      setP(r.data);
      toast.success("Documento subido");
    } catch (e) { toast.error(err(e, "No se pudo subir (PDF o imagen)")); }
    finally { setSubiendo(false); }
  };
  const quitarDoc = async (d) => {
    if (!window.confirm(`¿Borrar «${d.nombre}»?`)) return;
    try { setP((await axios.delete(`${API}/admin/proveedores/${id}/documentos/${d.id}`)).data); }
    catch { toast.error("No se pudo borrar"); }
  };
  const borrar = async () => {
    if (!window.confirm(`¿Borrar el proveedor «${p.nombre}» con todos sus datos y documentos?`)) return;
    try { await axios.delete(`${API}/admin/proveedores/${id}`); onCambio(); onVolver(); }
    catch { toast.error("No se pudo borrar"); }
  };

  if (!f || !p) return <p className="text-slate-400 p-6">Cargando…</p>;
  const prods = f.productos.map((x, i) => ({ x, i })).filter(({ x }) => !filtroProd || norm(`${x.nombre} ${x.referencia}`).includes(norm(filtroProd)));
  const celda = "h-8 text-sm";

  return (
    <div className="space-y-4 pb-20">
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={subir} />
      <button onClick={onVolver} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Volver</button>

      <Card className="border-slate-100"><CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className="font-semibold" /></div>
          <div>
            <Label>Categoría</Label>
            <Input list="cats-prov" value={f.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Vivero, macetas, plataformas…" />
            <datalist id="cats-prov">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div><Label>Web</Label><Input value={f.web} onChange={(e) => set("web", e.target.value)} placeholder="https://" /></div>
          <div><Label>Dirección</Label><Input value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></div>
        </div>
        <div><Label>Condiciones (pago, portes, pedido mínimo, plazo de entrega, descuentos…)</Label>
          <Textarea rows={2} value={f.condiciones} onChange={(e) => set("condiciones", e.target.value)} /></div>
        <div><Label>Notas</Label><Textarea rows={2} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></div>
      </CardContent></Card>

      <Card className="border-slate-100"><CardContent className="p-4 space-y-3">
        <div className="flex items-center"><p className="font-semibold text-slate-900 flex-1">Contactos</p>
          <Button variant="outline" size="sm" onClick={() => set("contactos", [...f.contactos, { ...vacioContacto }])}><Plus className="w-4 h-4 mr-1" />Añadir</Button></div>
        {f.contactos.length === 0 && <p className="text-xs text-slate-400">Comercial, almacén, administración…</p>}
        {f.contactos.map((c, i) => (
          <div key={i} className="border border-slate-200 rounded-md p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Input className={celda} placeholder="Nombre" value={c.nombre} onChange={(e) => setFila("contactos", i, "nombre", e.target.value)} />
              <Input className={celda} placeholder="Cargo / zona" value={c.cargo} onChange={(e) => setFila("contactos", i, "cargo", e.target.value)} />
              <Input className={celda} placeholder="Teléfono" value={c.telefono} onChange={(e) => setFila("contactos", i, "telefono", e.target.value)} />
              <Input className={celda} placeholder="Email" value={c.email} onChange={(e) => setFila("contactos", i, "email", e.target.value)} />
            </div>
            <div className="flex items-center gap-3 text-sm">
              {c.telefono && <a href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`} className="text-blue-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />Llamar</a>}
              {c.email && <a href={`mailto:${c.email}`} className="text-blue-600 flex items-center gap-1"><Mail className="w-3.5 h-3.5" />Escribir</a>}
              <button onClick={() => quitarFila("contactos", i)} className="ml-auto text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </CardContent></Card>

      <Card className="border-slate-100"><CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900 flex-1">Productos y tarifas</p>
          <Button variant="outline" size="sm" onClick={() => set("productos", [...f.productos, { ...vacioProducto, fecha_tarifa: new Date().toISOString().slice(0, 10) }])}><Plus className="w-4 h-4 mr-1" />Añadir</Button>
        </div>
        {f.productos.length > 5 && <Input className={celda} placeholder="Buscar en los productos…" value={filtroProd} onChange={(e) => setFiltroProd(e.target.value)} />}
        {f.productos.length === 0 && <p className="text-xs text-slate-400">Ej. «Maceta 40 L · 6,50 € · ud», «Alquiler plataforma 20 m · 180 € · día».</p>}
        {prods.map(({ x, i }) => (
          <div key={i} className="border border-slate-200 rounded-md p-2 space-y-1.5">
            <Input className={celda} placeholder="Producto o servicio" value={x.nombre} onChange={(e) => setFila("productos", i, "nombre", e.target.value)} />
            <div className="grid grid-cols-3 gap-1.5">
              <Input className={celda} inputMode="decimal" placeholder="Precio €" value={x.precio} onChange={(e) => setFila("productos", i, "precio", e.target.value)} />
              <Input className={celda} placeholder="Unidad (ud, día, m³…)" value={x.unidad} onChange={(e) => setFila("productos", i, "unidad", e.target.value)} />
              <Input className={celda} type="date" value={x.fecha_tarifa} onChange={(e) => setFila("productos", i, "fecha_tarifa", e.target.value)} title="Fecha de la tarifa" />
            </div>
            <div className="flex gap-1.5">
              <Input className={celda} placeholder="Referencia" value={x.referencia} onChange={(e) => setFila("productos", i, "referencia", e.target.value)} />
              <Input className={celda} placeholder="Notas" value={x.notas} onChange={(e) => setFila("productos", i, "notas", e.target.value)} />
              <button onClick={() => quitarFila("productos", i)} className="text-slate-300 hover:text-red-500 px-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </CardContent></Card>

      <Card className="border-slate-100"><CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900 flex-1">Documentos (tarifas, catálogos…)</p>
          <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className="border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="tarifa">Tarifa</option><option value="catalogo">Catálogo</option><option value="otro">Otro</option>
          </select>
          <Button variant="outline" size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" />{subiendo ? "Subiendo…" : "Subir"}</Button>
        </div>
        {(p.documentos || []).length === 0 && <p className="text-xs text-slate-400">PDF o foto de la tarifa.</p>}
        {(p.documentos || []).map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{d.nombre}</a>
            <span className="text-xs text-slate-400 shrink-0">{d.tipo} · {new Date(d.subido_at).toLocaleDateString("es-ES")}</span>
            <button onClick={() => quitarDoc(d)} className="ml-auto text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </CardContent></Card>

      <Button variant="ghost" size="sm" className="text-red-500" onClick={borrar}><Trash2 className="w-4 h-4 mr-1" />Borrar proveedor</Button>

      {sucio && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 p-3 flex items-center justify-center gap-3">
          <span className="text-sm text-amber-700">Cambios sin guardar</span>
          <Button onClick={guardar} disabled={guardando}><Save className="w-4 h-4 mr-1" />{guardando ? "Guardando…" : "Guardar"}</Button>
        </div>
      )}
    </div>
  );
};

/* ---------------- Lista ---------------- */
const AdminProveedoresPage = () => {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [nuevo, setNuevo] = useState(null);

  const cargar = useCallback(async () => {
    try { setLista((await axios.get(`${API}/admin/proveedores`)).data); }
    catch { toast.error("No se pudieron cargar los proveedores"); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const categorias = useMemo(() => [...new Set(lista.map((x) => x.categoria).filter(Boolean))].sort(), [lista]);
  const filtrada = useMemo(() => {
    const n = norm(q);
    return lista.filter((x) => {
      if (cat && x.categoria !== cat) return false;
      if (!n) return true;
      const texto = [x.nombre, x.categoria, x.notas, x.condiciones,
        ...(x.contactos || []).map((c) => `${c.nombre} ${c.telefono} ${c.email}`),
        ...(x.productos || []).map((pr) => `${pr.nombre} ${pr.referencia}`)].join(" ");
      return norm(texto).includes(n);
    });
  }, [lista, q, cat]);

  const crear = async () => {
    if (!nuevo?.nombre?.trim()) return toast.error("Pon el nombre");
    try {
      const r = await axios.post(`${API}/admin/proveedores`, { nombre: nuevo.nombre, categoria: nuevo.categoria || "" });
      setNuevo(null); await cargar(); setAbierto(r.data.id);
    } catch (e) { toast.error(err(e, "No se pudo crear")); }
  };

  return (
    <div data-testid="admin-proveedores-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center"><Store className="w-6 h-6 text-emerald-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">Proveedores</h1>
          <p className="text-sm text-slate-500">Contactos, productos, tarifas y documentos</p>
        </div>
      </div>

      {abierto ? (
        <Ficha id={abierto} onVolver={() => setAbierto(null)} onCambio={cargar} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input className="pl-8" placeholder="Buscar proveedor, producto, contacto…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="border border-slate-200 rounded-md px-2 py-2 text-sm bg-white">
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Button onClick={() => setNuevo({ nombre: "", categoria: "" })}><Plus className="w-4 h-4 mr-1" />Nuevo</Button>
          </div>

          {nuevo && (
            <Card className="border-emerald-200"><CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Nombre</Label><Input autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} onKeyDown={(e) => e.key === "Enter" && crear()} /></div>
                <div><Label>Categoría</Label>
                  <Input list="cats-prov-n" value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} />
                  <datalist id="cats-prov-n">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist></div>
              </div>
              <div className="flex gap-2"><Button onClick={crear}>Crear y abrir ficha</Button><Button variant="ghost" onClick={() => setNuevo(null)}>Cancelar</Button></div>
            </CardContent></Card>
          )}

          {cargando && <p className="text-sm text-slate-400">Cargando…</p>}
          {!cargando && filtrada.length === 0 && <p className="text-sm text-slate-400">{lista.length === 0 ? "Aún no hay proveedores." : "Sin resultados."}</p>}
          {filtrada.map((x) => {
            const c = (x.contactos || []).find((k) => k.telefono || k.email) || {};
            return (
              <Card key={x.id} className="border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => setAbierto(x.id)}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 flex-1 truncate">{x.nombre}</p>
                    {x.categoria && <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 shrink-0">{x.categoria}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600" onClick={(e) => e.stopPropagation()}>
                    {c.telefono && <a href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`} className="text-blue-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{c.telefono}</a>}
                    {c.email && <a href={`mailto:${c.email}`} className="text-blue-600 flex items-center gap-1 break-all"><Mail className="w-3.5 h-3.5" />{c.email}</a>}
                    {x.web && <a href={x.web.startsWith("http") ? x.web : `https://${x.web}`} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1"><Globe className="w-3.5 h-3.5" />Web</a>}
                    {x.direccion && <span className="flex items-center gap-1 text-slate-500"><MapPin className="w-3.5 h-3.5" />{x.direccion}</span>}
                  </div>
                  <p className="text-xs text-slate-400">{(x.productos || []).length} producto(s) · {(x.documentos || []).length} documento(s){(x.productos || []).some((pr) => pr.precio != null) ? ` · desde ${euros(Math.min(...x.productos.filter((pr) => pr.precio != null).map((pr) => pr.precio)))}` : ""}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminProveedoresPage;
