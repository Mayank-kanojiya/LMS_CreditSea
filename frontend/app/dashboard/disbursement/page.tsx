'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import api, { getApiErrorMessage } from '@/lib/api';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

interface DisbursementLoan {
  _id: string;
  borrower?: { name: string; email: string };
  tenure: number;
  loanAmount: number;
  totalRepayment: number;
}

export default function DisbursementPage() {
  const { user, loaded, logout } = useAuth();
  const router = useRouter();
  const [loans, setLoans] = useState<DisbursementLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  const fetchLoans = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/disbursement/loans');
      setLoans(data);
      setError('');
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setError(message || 'Unable to refresh disbursement loans.');
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!user) { router.push('/login'); return; }
    if (!['disbursement', 'admin'].includes(user.role)) { router.push('/dashboard'); return; }
    let active = true;
    api.get('/dashboard/disbursement/loans')
      .then(r => { if (active) setLoans(r.data); })
      .catch((err: unknown) => {
        if (!active) return;
        const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
        setError(message || 'Unable to load disbursement loans.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, loaded, router]);
  useLiveRefresh(fetchLoans, !!user && ['disbursement', 'admin'].includes(user.role));

  const handleDisburse = async (id: string) => {
    setError('');
    setActionLoading(id);
    try {
      await api.patch(`/dashboard/disbursement/loans/${id}`, {});
      await fetchLoans();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Unable to mark the loan as disbursed.'));
    } finally { setActionLoading(''); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-bold text-green-700">Disbursement — Sanctioned Loans</h1>
        </div>
        <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
      </nav>
      <div className="max-w-5xl mx-auto mt-8 px-4 space-y-4">
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {loading ? <p className="text-gray-400">Loading...</p> : loans.length === 0 ? <p className="text-gray-400">No sanctioned loans.</p> : (
          loans.map(loan => (
            <div key={loan._id} className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap justify-between items-center gap-4">
              <div>
                <p className="font-semibold text-gray-800">{loan.borrower?.name}</p>
                <p className="text-sm text-gray-500">{loan.borrower?.email}</p>
                <p className="text-xs text-gray-400 mt-1">{loan.tenure} days | Sanctioned</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-700">₹{loan.loanAmount?.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Total Repayment: ₹{loan.totalRepayment?.toLocaleString()}</p>
              </div>
              <button onClick={() => handleDisburse(loan._id)} disabled={!!actionLoading}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                {actionLoading === loan._id ? 'Processing...' : 'Mark as Disbursed'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
