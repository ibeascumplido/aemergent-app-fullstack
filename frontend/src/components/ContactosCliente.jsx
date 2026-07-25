import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyForm = { nombre: "", cargo: "", telefono: "", email: "", notas: "" };

/**
 * Contactos de responsables por cliente (Fase 16): puede haber varios.
 * Gestion (crear/editar/borrar) solo admin; cualquier aprobado consulta.
 */
const ContactosCliente = ({ clientId }) => {
  const { isAdmin } = useAuth();
  const [contactos, setContactos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/contactos`, { params: { client_id: clientId } });
      setContactos(res.data);
    } catch (err) {
      console.error("Error cargando contactos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      cargo: c.cargo || "",
      telefono: c.telefono || "",
      email: c.email || "",
      notas: c.notas || "",
    });
    setDialogOpen(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await axios.put(`${API}/contactos/${editando.id}`, {
          nombre: form.nombre.trim(),
          cargo: form.cargo.trim() || null,
          telefono: form.telefono.trim() || null,
          email: form.email.trim() || null,
          notas: form.notas.trim(),
        });
        toast.success("Contacto actualizado");
      } else {
        await axios.post(`${API}/contactos`, {
          client_id: clientId,
          nombre: form.nombre.trim(),
          cargo: form.cargo.trim() || null,
          telefono: form.telefono.trim() || null,
          email: form.email.trim() || null,
          notas: form.notas.trim(),
        });
        toast.success("Contacto añadido");
      }
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error guardando contacto:", err);
      toast.error("Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/contactos/${aBorrar.id}`);
      toast.success("Contacto eliminado");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando contacto:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading) return null;

  return (
    <div data-testid="contactos-cliente">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Contactos de responsables ({contactos.length})
        </h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={abrirNuevo} data-testid="nuevo-contacto-btn">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nuevo contacto
          </Button>
        )}
      </div>

      {contactos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin contactos registrados.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {contactos.map((c) => (
            <div
              key={c.id}
              className="px-4 py-3 rounded-lg border border-slate-200"
              data-testid={`contacto-${c.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{c.nombre}</p>
                  {c.cargo && <p className="text-xs text-slate-400">{c.cargo}</p>}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEditar(c)}
                      className="text-slate-300 hover:text-indigo-500 p-0.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setABorrar(c)}
                      className="text-slate-300 hover:text-red-500 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-1">
                {c.telefono && (
                  <a
                    href={`tel:${c.telefono}`}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600"
                  >
                    <Phone className="w-3 h-3" />
                    {c.telefono}
                  </a>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 truncate"
                  >
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </a>
                )}
              </div>
              {c.notas && <p className="text-xs text-slate-400 mt-2">{c.notas}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                data-testid="nombre-contacto-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input
                value={form.cargo}
                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                placeholder="Ej. Gerente, Responsable de mantenimiento..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={guardando}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="guardar-contacto-btn"
            >
              {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{aBorrar?.nombre}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContactosCliente;
