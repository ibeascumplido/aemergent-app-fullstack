import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  Shield,
  Trash2,
  Check,
  X,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRESET_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899",
  "#06B6D4", "#84CC16", "#F97316", "#6366F1", "#14B8A6", "#A855F7",
];

const DIAS_AVISO_PREVIO = 30;

const tieneAlertaRevision = (fechaProxima) => {
  if (!fechaProxima) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const proxima = new Date(fechaProxima + "T00:00:00");
  const diasRestantes = Math.round((proxima - hoy) / (1000 * 60 * 60 * 24));
  return diasRestantes <= DIAS_AVISO_PREVIO;
};

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/users`);
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async (userId) => {
    try {
      await axios.put(`${API}/admin/users/${userId}`, { status: "approved" });
      toast.success("Usuario aprobado");
      fetchUsers();
    } catch (error) {
      toast.error("Error al aprobar usuario");
    }
  };

  const handleReject = async (userId) => {
    try {
      await axios.put(`${API}/admin/users/${userId}`, { status: "rejected" });
      toast.success("Usuario rechazado");
      fetchUsers();
    } catch (error) {
      toast.error("Error al rechazar usuario");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      await axios.put(`${API}/admin/users/${editingUser.user_id}`, {
        name: editingUser.name,
        role: editingUser.role,
        status: editingUser.status,
        dias_vacaciones: editingUser.dias_vacaciones,
        dias_libres: editingUser.dias_libres,
        color: editingUser.color,
        abreviatura: editingUser.abreviatura,
        puesto: editingUser.puesto || "",
      });
      toast.success("Usuario actualizado");
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error("Error al actualizar usuario");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;
    
    try {
      await axios.delete(`${API}/admin/users/${deleteConfirm.user_id}`);
      toast.success("Usuario eliminado");
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar usuario");
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = users.filter(u => u.status === "pending").length;
  const approvedCount = users.filter(u => u.status === "approved").length;
  const adminCount = users.filter(u => u.role === "admin").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div data-testid="admin-users-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Gestión de Usuarios
          </h1>
          <p className="text-slate-500 mt-1">Administra los accesos y permisos</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-slate-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{users.length}</p>
              <p className="text-sm text-slate-500">Total usuarios</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-900">{pendingCount}</p>
              <p className="text-sm text-orange-700">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-900">{approvedCount}</p>
              <p className="text-sm text-green-700">Aprobados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-900">{adminCount}</p>
              <p className="text-sm text-purple-700">Administradores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-slate-100 shadow-sm mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="approved">Aprobados</SelectItem>
                <SelectItem value="rejected">Rechazados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Rol</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Vacaciones</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Días Libres</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: user.color || "#3B82F6" }}
                          >
                            {user.picture ? (
                              <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              user.abreviatura || user.name?.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 inline-flex items-center gap-1.5">
                              {user.name}
                              {tieneAlertaRevision(user.fecha_proxima_revision_medica) && (
                                <AlertTriangle
                                  className="w-3.5 h-3.5 text-amber-500"
                                  title="Revisión médica próxima o vencida"
                                />
                              )}
                            </p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                            {user.puesto && (
                              <p className="text-xs text-slate-400">{user.puesto}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.status === "approved" ? "bg-green-100 text-green-700" :
                          user.status === "pending" ? "bg-orange-100 text-orange-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {user.status === "approved" ? "Aprobado" :
                           user.status === "pending" ? "Pendiente" : "Rechazado"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          {user.role === "admin" ? "Admin" : "Usuario"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm">
                        {user.dias_vacaciones || 32}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm">
                        {user.dias_libres || 6}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {user.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleApprove(user.user_id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleReject(user.user_id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/users/${user.user_id}`)}
                            data-testid={`ver-ficha-${user.user_id}`}
                          >
                            Ficha
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingUser({ ...user });
                              setShowEditModal(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setDeleteConfirm(user)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Puesto</Label>
                <Input
                  value={editingUser.puesto || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, puesto: e.target.value })}
                  placeholder="Ej. Operario, Encargado, Gerente..."
                  data-testid="edit-puesto-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Abreviatura</Label>
                  <Input
                    value={editingUser.abreviatura || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, abreviatura: e.target.value.slice(0, 3).toUpperCase() })}
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(v) => setEditingUser({ ...editingUser, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={editingUser.status}
                  onValueChange={(v) => setEditingUser({ ...editingUser, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Días vacaciones</Label>
                  <Input
                    type="number"
                    value={editingUser.dias_vacaciones || 32}
                    onChange={(e) => setEditingUser({ ...editingUser, dias_vacaciones: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Días libres</Label>
                  <Input
                    type="number"
                    value={editingUser.dias_libres || 6}
                    onChange={(e) => setEditingUser({ ...editingUser, dias_libres: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingUser({ ...editingUser, color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        editingUser.color === color ? "border-slate-900 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser} className="bg-red-500 hover:bg-red-600">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleteConfirm?.name}" y todos sus datos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
