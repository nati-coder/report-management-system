import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('rms_token'));

  useEffect(() => {
    if (!localStorage.getItem('rms_token')) return;
    authService.me().then(setUser).catch(() => localStorage.removeItem('rms_token')).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await authService.login(email, password);
    localStorage.setItem('rms_token', token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('rms_token');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, isAuthenticated: !!user }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
