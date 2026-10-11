'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

export type Role = 'borrower' | 'sales' | 'sanction' | 'disbursement' | 'collection' | 'admin';
interface User { id: string; name: string; email: string; role: Role; }
interface AuthCtx { user: User | null; token: string | null; loaded: boolean; login: (token: string, user: User) => void; logout: () => void; }

const AuthContext = createContext<AuthCtx | null>(null);

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Partial<User>;
  return typeof user.id === 'string'
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && ['borrower', 'sales', 'sanction', 'disbursement', 'collection', 'admin'].includes(String(user.role));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => {
      const storedToken = Cookies.get('token');
      const storedUser = Cookies.get('user');
      let parsedUser: unknown;

      if (storedUser) {
        try {
          parsedUser = JSON.parse(storedUser);
        } catch {
          Cookies.remove('token');
          Cookies.remove('user');
        }
      }

      if (storedToken && isUser(parsedUser)) {
        setToken(storedToken);
        setUser(parsedUser);
      } else if (storedToken || storedUser) {
        Cookies.remove('token');
        Cookies.remove('user');
      }
      setLoaded(true);
    });
  }, []);

  const login = (t: string, u: User) => {
    Cookies.set('token', t, { expires: 7 });
    Cookies.set('user', JSON.stringify(u), { expires: 7 });
    setToken(t); setUser(u);
  };

  const logout = () => {
    Cookies.remove('token'); Cookies.remove('user');
    setToken(null); setUser(null);
    router.push('/login');
  };

  return <AuthContext.Provider value={{ user, token, loaded, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
