import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Search,
  ChevronRight,
  Image,
  FileText,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Color de avatar derivado del nombre (estable por cliente)
const COLORES = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const colorDe = (nombre) => {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h);
  return COLORES[Math.abs(h) % COLORES.length];
};

// Genera un slug URL-friendly a partir del nombre del cliente.
// Reemplaza espacios y acentos, deja solo minúsculas, dígitos y guiones.
const slugify = (str) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Tamaño máximo del logo en bytes (200 KB). Si crece más, migramos a Cloudinary.
const MAX_LOGO_BYTES = 200 * 1024;

const emptyForm = { slug: "", nombre: "", notas: "", logo_url: null };

const ClientsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Estado del diálogo crear/editar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = modo crear
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false); // si el usuario edita slug a mano, dejamos de autogenerarlo

  // Estado del diálogo de confirmación de borrado
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/clients`);
      setClientes(res.data);
    } catch (err) {
      console.error("Error cargando clientes:", err);
      toast.error("Error al cargar los clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const abrirFicha = (cliente) => {
    navigate(`/clients/${cliente.slug}`);
  };

  // --- Handlers CRUD ---------------------------------------------------------

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (cliente) => {
    setEditingId(cliente.id);
    setForm({
      slug: cliente.slug,
      nombre: cliente.nombre,
      notas: cliente.notas || "",
      logo_url: cliente.logo_url || null,
    });
    setSlugTouched(true); // en edición no autogeneramos slug (además va deshabilitado)
    setDialogOpen(true);
  };

  const handleNombreChange = (e) => {
    const nombre = e.target.value;
    setForm((f) => ({
      ...f,
      nombre,
      // solo autogeneramos slug si es modo creación y el usuario no lo ha editado
      slug: !editingId && !slugTouched ? slugify(nombre) : f.slug,
    }));
  };

  const handleSlugChange = (e) => {
    setSlugTouched(true);
    setForm((f) => ({ ...f, slug: e.target.value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`La imagen supera los ${Math.round(MAX_LOGO_BYTES / 1024)} KB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, logo_url: reader.result }));
    };
    reader.onerror = () => toast.error("No se pudo leer la imagen");
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    // Validaciones mínimas
    const nombre = form.nombre.trim();
    const slug = slugify(form.slug); // limpia lo que el usuario haya podido escribir
    const notas = (form.notas || "").trim();

    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!editingId && !slug) {
      toast.error("El slug es obligatorio");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // PUT: NO enviamos slug (el backend lo ignora, no se puede cambiar)
        await axios.put(`${API}/clients/${editingId}`, {
          nombre,
          notas,
          logo_url: form.logo_url,
        });
        toast.success("Cliente actualizado");
      } else {
        await axios.post(`${API}/clients`, {
          slug,
          nombre,
          notas,
          logo_url: form.logo_url,
        });
        toast.success("Cliente creado");
      }
      setDialogOpen(false);
      await fetchClientes();
    } catch (err) {
      console.error("Error guardando cliente:", err);
      const status = err?.response?.status;
      if (status === 409) toast.error("Ya existe un cliente con ese slug");
      else if (status === 400) toast.error(err.response.data?.detail || "Datos inválidos");
      else if (status === 403) toast.error("No tienes permisos para esta acción");
      else toast.error("Error al guardar el cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/clients/${deleteTarget.id}`);
      toast.success("Cliente eliminado");
      setDeleteTarget(null);
      await fetchClientes();
    } catch (err) {
      console.error("Error eliminando cliente:", err);
      const status = err?.response?.status;
      if (status === 403) toast.error("No tienes permisos para eliminar");
      else toast.error("Error al eliminar el cliente");
    } finally {
      setDeleting(false);
    }
  };

  // --- Render ---------------------------------------------------------------

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div data-testid="clients-page">
      {/* Cabecera */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Clientes
          </h1>
          <p className="text-slate-500 mt-1">
            {filtrados.length} {filtrados.length === 1 ? "cliente" : "clientes"} · cada ficha reunirá fotos, partes de trabajo e incidencias
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={openCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            data-testid="create-client-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo cliente
          </Button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-slate-200"
          data-testid="search-clients"
        />
      </div>

      {/* Rejilla / estados */}
      {loading ? (
        <div className="p-8 text-center text-slate-400" data-testid="loading-clients">
          Cargando clientes...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-8 text-center text-slate-400" data-testid="no-clients">
          {clientes.length === 0
            ? "No hay clientes disponibles"
            : "No hay clientes que coincidan con la búsqueda"}
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtrados.map((c) => (
            <motion.div key={c.slug} variants={item}>
              <Card
                className="border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                onClick={() => abrirFicha(c)}
                data-testid={`client-card-${c.slug}`}
              >
                {/* Botones admin: se muestran en hover */}
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-slate-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(c);
                      }}
                      data-testid={`edit-client-${c.slug}`}
                    >
                      <Pencil className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
                      }}
                      data-testid={`delete-client-${c.slug}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: c.logo_url ? "#fff" : colorDe(c.nombre) }}
                    >
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.nombre} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{c.nombre}</p>
                      <div className="flex items-center gap-3 mt-1 text-slate-400">
                        <Image className="w-4 h-4" />
                        <FileText className="w-4 h-4" />
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Diálogo crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="client-form-dialog">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar cliente" : "Nuevo cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cliente-nombre">Nombre</Label>
              <Input
                id="cliente-nombre"
                value={form.nombre}
                onChange={handleNombreChange}
                placeholder="Ej. SANITAS"
                data-testid="client-nombre-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cliente-slug">
                Slug (identificador URL)
                {editingId && (
                  <span className="text-xs text-slate-400 ml-2">no editable</span>
                )}
              </Label>
              <Input
                id="cliente-slug"
                value={form.slug}
                onChange={handleSlugChange}
                placeholder="ej. sanitas"
                disabled={!!editingId}
                data-testid="client-slug-input"
              />
              <p className="text-xs text-slate-400">
                Minúsculas, números y guiones. Se autogenera desde el nombre.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cliente-notas">Notas (opcional)</Label>
              <Textarea
                id="cliente-notas"
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Información interna, avisos, contexto..."
                rows={3}
                data-testid="client-notas-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white shrink-0 overflow-hidden border border-slate-200"
                  style={{
                    backgroundColor: form.logo_url ? "#fff" : colorDe(form.nombre || "?"),
                  }}
                >
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Building2 className="w-8 h-8" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                      data-testid="client-logo-input"
                    />
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50">
                      <Upload className="w-4 h-4" />
                      {form.logo_url ? "Cambiar logo" : "Subir logo"}
                    </span>
                  </label>
                  {form.logo_url && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, logo_url: null }))}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                      Quitar logo
                    </button>
                  )}
                  <p className="text-xs text-slate-400">
                    Máx. {Math.round(MAX_LOGO_BYTES / 1024)} KB. PNG, JPG o SVG.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="client-save-btn"
            >
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de borrado */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent data-testid="delete-client-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-semibold">{deleteTarget?.nombre}</span>.
              El cliente se dará de baja de forma reversible (soft delete): sus datos
              históricos no se pierden, pero deja de aparecer en el listado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-client-btn"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsPage;
