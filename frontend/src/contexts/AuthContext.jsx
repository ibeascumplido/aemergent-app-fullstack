import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Configure axios to send session token in headers
axios.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem('session_token');
  if (sessionToken) {
    config.headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  return config;
});

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    const intentar = () => axios.get(`${API}/auth/me`);

    try {
      const response = await intentar();
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        // El propio servidor confirma que el token no es valido: aqui
        // si toca cerrar sesion de verdad.
        localStorage.removeItem('session_token');
        setUser(null);
        setIsAuthenticated(false);
      } else {
        // Sin respuesta del servidor (error de red, timeout...): un
        // solo reintento tras una breve espera antes de rendirse, util
        // sobre todo en la carga inicial de la pagina con una conexion
        // inestable (muy comun en movil). Si el reintento tambien
        // falla, NO se cierra sesion (ver comentario en checkAuth) -
        // simplemente se deja el estado como estaba.
        await new Promise((r) => setTimeout(r, 1200));
        try {
          const response = await intentar();
          setUser(response.data);
          setIsAuthenticated(true);
        } catch (error2) {
          const status2 = error2?.response?.status;
          if (status2 === 401 || status2 === 403) {
            localStorage.removeItem('session_token');
            setUser(null);
            setIsAuthenticated(false);
          }
          // Fase 12: solo cerrar sesion (borrar el token) cuando el
          // propio servidor confirma que el token no es valido
          // (401/403). Un fallo de red momentaneo (muy comun en movil:
          // datos moviles, cambio entre wifi/datos, o Android recargando
          // la pestana en segundo plano) NO significa que la sesion haya
          // caducado - antes esto borraba el token ante CUALQUIER error,
          // causando cierres de sesion intermitentes e injustificados
          // especialmente en movil.
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem('session_token', response.data.session_token);
    setUser(response.data.user);
    setIsAuthenticated(true);
    return response.data;
  };

  const register = async (email, password, name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, name });
    localStorage.setItem('session_token', response.data.session_token);
    setUser(response.data.user);
    setIsAuthenticated(true);
    return response.data;
  };

  const loginWithGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {});
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('session_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const isAdmin = user?.role === 'admin';
  const isFacturacion = user?.role === 'facturacion';
  const canBudgets = isAdmin || isFacturacion;
  const isApproved = user?.status === 'approved' || isAdmin;
  const isPending = user?.status === 'pending';

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      loading,
      isAuthenticated,
      isAdmin,
      isFacturacion,
      canBudgets,
      isApproved,
      isPending,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
