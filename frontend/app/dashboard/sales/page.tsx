'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import api from '@/lib/api';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

interface SalesLead {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function SalesPage() {
  const { user, loaded, logout } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshLeads = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/sales/leads');
      setLeads(data);
      setError('');
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setError(message || 'Unable to refresh sales leads.');
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!user) { router.push('/login'); return; }
    if (!['sales', 'admin'].includes(user.role)) { router.push('/dashboard'); return; }
    let active = true;
    api.get('/dashboard/sales/leads')
      .then(r => { if (active) setLeads(r.data); })
      .catch((err: unknown) => {
        if (!active) return;
        const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
        setError(message || 'Unable to load sales leads.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, loaded, router]);
  useLiveRefresh(refreshLeads, !!user && ['sales', 'admin'].includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-bold text-purple-700">Sales — Leads</h1>
        </div>
        <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
      </nav>
      <div className="max-w-4xl mx-auto mt-8 px-4">
        {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}
        {loading ? <p className="text-gray-400">Loading...</p> : (
          leads.length === 0 ? <p className="text-gray-400">No leads yet.</p> : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name', 'Email', 'Registered'].map(h => <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l._id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{l.name}</td>
                      <td className="px-4 py-3 text-gray-600">{l.email}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(l.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
