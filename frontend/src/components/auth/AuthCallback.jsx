import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      // Extract session_id from URL fragment
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        console.error('No session_id found');
        navigate('/login');
        return;
      }

      try {
        // Exchange session_id for our session
        const response = await axios.post(`${API}/auth/session`, 
          { session_id: sessionId }
        );

        localStorage.setItem('session_token', response.data.session_token);
        setUser(response.data.user);
        
        // Clear hash and redirect to dashboard
        window.history.replaceState(null, '', window.location.pathname);
        navigate('/', { replace: true, state: { user: response.data.user } });
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login');
      }
    };

    processCallback();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-red-500 mx-auto mb-4" />
        <p className="text-slate-600">Procesando autenticación...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
