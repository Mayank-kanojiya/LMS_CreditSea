'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import api from '@/lib/api';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

interface CollectionLoan {
  _id: string;
  borrower?: { name: string; email: string };
  status: 'disbursed' | 'closed';
  loanAmount: number;
  totalRepayment: number;
  outstanding: number;
}

interface Payment {
  _id: string;
  utr: string;
  amount: number;
  date: string;
}

export default function CollectionPage() {
  const { user, loaded, logout } = useAuth();
  const router = useRouter();
  const [loans, setLoans] = useState<CollectionLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [form, setForm] = useState({ utr: '', amount: '', date: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshCollection = useCallback(async () => {
    try {
      const { data: latestLoans } = await api.get('/dashboard/collection/loans');
      setLoans(latestLoans);
      if (selected) {
        const { data } = await api.get(`/dashboard/collection/loans/${selected}/payments`);
        setPayments(data.payments);
        setOutstanding(data.outstanding);
      }
      setError('');
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setError(message || 'Unable to refresh collection data.');
    }
  }, [selected]);

  useEffect(() => {
    if (!loaded) return;
    if (!user) { router.push('/login'); return; }
    if (!['collection', 'admin'].includes(user.role)) { router.push('/dashboard'); return; }
    let active = true;
    api.get('/dashboard/collection/loans')
      .then(r => { if (active) setLoans(r.data); })
      .catch((err: unknown) => {
        if (!active) return;
        const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
        setError(message || 'Unable to load collection loans.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, loaded, router]);
  useLiveRefresh(refreshCollection, !!user && ['collection', 'admin'].includes(user.role));

  const selectLoan = async (id: string) => {
    setSelected(id); setError('');
    try {
      const { data } = await api.get(`/dashboard/collection/loans/${id}/payments`);
      setPayments(data.payments);
      setOutstanding(data.outstanding);
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setError(message || 'Unable to load payment history.');
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      await api.post(`/dashboard/collection/loans/${selected}/payments`, { ...form, amount: Number(form.amount) });
      setForm({ utr: '', amount: '', date: '' });
      await refreshCollection();
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setError(message || 'Failed');
    } finally { setSubmitting(false); }
  };

  const selectedLoan = loans.find(l => l._id === selected);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-bold text-orange-700">Collection — Active Loans</h1>
        </div>
        <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
      </nav>
      <div className="max-w-6xl mx-auto mt-8 px-4 flex gap-6">
        {/* Loan List */}
        <div className="w-full md:w-1/2 space-y-3">
          {loading ? <p className="text-gray-400">Loading...</p> : loans.length === 0 ? <p className="text-gray-400">No active loans.</p> : (
            loans.map(loan => (
              <div key={loan._id} onClick={() => selectLoan(loan._id)}
                className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition border-2 ${selected === loan._id ? 'border-orange-400' : 'border-transparent'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{loan.borrower?.name}</p>
                    <p className="text-xs text-gray-400">{loan.borrower?.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${loan.status === 'closed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'}`}>
                    {loan.status}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">₹{loan.loanAmount?.toLocaleString()}</span>
                  <span className="text-gray-500">Outstanding: ₹{loan.outstanding?.toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Payment Panel */}
        {selected && selectedLoan && (
          <div className="w-full md:w-1/2">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-1">{selectedLoan.borrower?.name}</h3>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-500">Total Repayment: ₹{selectedLoan.totalRepayment?.toLocaleString()}</span>
                <span className={`font-semibold ${outstanding <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  Outstanding: ₹{outstanding.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Paid: ₹{Math.max(0, selectedLoan.totalRepayment - outstanding).toLocaleString()}</p>

              {selectedLoan.status !== 'closed' && (
                <form onSubmit={handlePayment} className="space-y-3 mb-4">
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <input required placeholder="UTR Number" value={form.utr} onChange={e => setForm({ ...form, utr: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <input required type="number" min="0.01" step="0.01" max={outstanding} placeholder="Amount (₹)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <button type="submit" disabled={submitting}
                    className="w-full bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                    {submitting ? 'Recording...' : 'Record Payment'}
                  </button>
                </form>
              )}

              <h4 className="text-sm font-medium text-gray-600 mb-2">Payment History</h4>
              {payments.length === 0 ? <p className="text-xs text-gray-400">No payments yet.</p> : (
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p._id} className="flex justify-between text-xs bg-gray-50 rounded p-2">
                      <span className="text-gray-500 font-mono">{p.utr}</span>
                      <span className="text-gray-700">₹{p.amount.toLocaleString()}</span>
                      <span className="text-gray-400">{new Date(p.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
