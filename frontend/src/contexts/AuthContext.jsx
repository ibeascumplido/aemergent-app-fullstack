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

    // Hasta 3 intentos con espera progresiva (0.8s, 1.6s) ante fallos de
    // RED. En movil es muy comun que la primera peticion falle por un
    // bache de conexion (cambio wifi/datos, cobertura floja, o Android
    // reactivando la pestana tras congelarla en segundo plano). Solo un
    // 401/403 del propio servidor cierra la sesion; un fallo de red
    // nunca borra el token, para no expulsar al usuario sin motivo real.
    const esperas = [800, 1600];
    for (let intento = 0; intento < 3; intento++) {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
        setIsAuthenticated(true);
        setLoading(false);
        return;
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('session_token');
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        // Error de red (sin respuesta del servidor): esperar y reintentar.
        if (intento < esperas.length) {
          await new Promise((r) => setTimeout(r, esperas[intento]));
        }
      }
    }
    // Agotados los reintentos por red: NO se borra el token ni se cierra
    // sesion. Se deja el estado como estaba para no expulsar al usuario.
    setLoading(false);
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

  useEffect(() => {
    // Cuando el usuario vuelve a la app tras tenerla en segundo plano,
    // Android puede haber congelado o recargado la pestana. Al volver a
    // ser visible, revalidamos la sesion en silencio: si el token seguia
    // bueno, la app se recupera sola en vez de fallar en el primer boton
    // que se pulse. Solo se hace si hay token y sin bloquear la interfaz
    // (no toca 'loading'), y checkAuth ya garantiza que un fallo de red
    // no cierra la sesion.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('session_token')) {
        axios
          .get(`${API}/auth/me`)
          .then((response) => {
            setUser(response.data);
            setIsAuthenticated(true);
          })
          .catch((error) => {
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
              localStorage.removeItem('session_token');
              setUser(null);
              setIsAuthenticated(false);
            }
            // Fallo de red: no hacer nada, se deja como estaba.
          });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

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
