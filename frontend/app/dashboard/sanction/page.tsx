'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import api, { API_BASE_URL } from '@/lib/api';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

interface SanctionLoan {
  _id: string;
  borrower?: { name: string; email: string };
  pan: string;
  dob: string;
  monthlySalary: number;
  employmentMode: string;
  loanAmount: number;
  tenure: number;
  totalRepayment: number;
  salarySlipUrl?: string;
}

export default function SanctionPage() {
  const { user, loaded, logout } = useAuth();
  const router = useRouter();
  const [loans, setLoans] = useState<SanctionLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const fetchLoans = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/sanction/loans');
      setLoans(data);
      setError('');
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setError(message || 'Unable to refresh sanction loans.');
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!user) { router.push('/login'); return; }
    if (!['sanction', 'admin'].includes(user.role)) { router.push('/dashboard'); return; }
    let active = true;
    api.get('/dashboard/sanction/loans')
      .then(r => { if (active) setLoans(r.data); })
      .catch((err: unknown) => {
        if (!active) return;
        const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
        setError(message || 'Unable to load sanction loans.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, loaded, router]);
  useLiveRefresh(fetchLoans, !!user && ['sanction', 'admin'].includes(user.role));

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason[id]?.trim()) {
      setError('Enter a rejection reason before rejecting this loan.');
      return;
    }
    setError('');
    setActionLoading(id + action);
    try {
      await api.patch(`/dashboard/sanction/loans/${id}`, { action, rejectionReason: rejectReason[id] });
      await fetchLoans();
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setError(message || 'Unable to update the loan.');
    } finally { setActionLoading(''); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-bold text-blue-700">Sanction — Applied Loans</h1>
        </div>
        <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
      </nav>
      <div className="max-w-5xl mx-auto mt-8 px-4 space-y-4">
        {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
        {loading ? <p className="text-gray-400">Loading...</p> : loans.length === 0 ? <p className="text-gray-400">No applied loans.</p> : (
          loans.map(loan => (
            <div key={loan._id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">{loan.borrower?.name}</p>
                  <p className="text-sm text-gray-500">{loan.borrower?.email}</p>
                  <p className="text-xs text-gray-400 mt-1">PAN: {loan.pan} | DOB: {loan.dob}</p>
                  <p className="text-xs text-gray-400">Salary: ₹{loan.monthlySalary?.toLocaleString()} | {loan.employmentMode}</p>
                  {loan.salarySlipUrl && (
                    <a
                      href={new URL(`/uploads/${encodeURIComponent(loan.salarySlipUrl)}`, API_BASE_URL).toString()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-sm text-blue-600 hover:underline"
                    >
                      View salary slip
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-700">₹{loan.loanAmount?.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{loan.tenure} days | Total: ₹{loan.totalRepayment?.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <input placeholder="Rejection reason (if rejecting)"
                  value={rejectReason[loan._id] || ''}
                  onChange={e => setRejectReason({ ...rejectReason, [loan._id]: e.target.value })}
                  className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => handleAction(loan._id, 'approve')} disabled={!!actionLoading}
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                  {actionLoading === loan._id + 'approve' ? '...' : 'Approve'}
                </button>
                <button onClick={() => handleAction(loan._id, 'reject')} disabled={!!actionLoading}
                  className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
                  {actionLoading === loan._id + 'reject' ? '...' : 'Reject'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
