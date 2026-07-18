import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  Palmtree,
  Sun,
  AlertCircle,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        axios.get(`${API}/notifications`, { params: { limit: 20 } }),
        axios.get(`${API}/notifications/count`)
      ]);
      setNotifications(notifRes.data);
      setUnreadCount(countRes.data.unread_count);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${API}/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleClickNotification = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.type === "foto_comentario" && notification.data?.lote_id) {
      setOpen(false);
      navigate(`/fotos/lote/${notification.data.lote_id}`);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "vacation_approved":
        return <Check className="w-4 h-4 text-green-500" />;
      case "vacation_rejected":
        return <X className="w-4 h-4 text-red-500" />;
      case "user_approved":
        return <Check className="w-4 h-4 text-green-500" />;
      case "user_rejected":
        return <X className="w-4 h-4 text-red-500" />;
      case "foto_comentario":
        return <Camera className="w-4 h-4 text-indigo-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getNotificationBgColor = (type, read) => {
    if (read) return "bg-white";
    switch (type) {
      case "vacation_approved":
        return "bg-green-50";
      case "vacation_rejected":
        return "bg-red-50";
      default:
        return "bg-blue-50";
    }
  };

  const formatTime = (dateStr) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch {
      return "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative"
          data-testid="notification-bell"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={markAllAsRead}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              Cargando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500">No tienes notificaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-50 transition-colors ${
                    notification.type === "foto_comentario" && notification.data?.lote_id
                      ? "cursor-pointer"
                      : ""
                  } ${
                    getNotificationBgColor(notification.type, notification.read)
                  }`}
                  onClick={() => handleClickNotification(notification)}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notification.read ? "text-slate-600" : "text-slate-900 font-medium"}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-green-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          title="Marcar como leída"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
