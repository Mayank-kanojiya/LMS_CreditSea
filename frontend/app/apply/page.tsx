'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { getApiErrorMessage } from '@/lib/api';

type Step = 1 | 2 | 3 | 4;
const STEPS = ['Personal Details', 'Upload Salary Slip', 'Loan Configuration', 'Review'];
type LoanStatus = 'applied' | 'sanctioned' | 'rejected' | 'disbursed' | 'closed';

interface LoanApplication {
  _id: string;
  loanAmount?: number;
  tenure?: number;
  totalRepayment?: number;
  status: LoanStatus;
  rejectionReason?: string;
}

export default function ApplyPage() {
  const { user, loaded, logout } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loanId, setLoanId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [personal, setPersonal] = useState({ fullName: '', pan: '', dob: '', monthlySalary: '', employmentMode: 'salaried' });
  const [file, setFile] = useState<File | null>(null);
  const [loanAmount, setLoanAmount] = useState(50000);
  const [tenure, setTenure] = useState(30);
  const [appliedLoan, setAppliedLoan] = useState<LoanApplication | null>(null);
  const [myLoans, setMyLoans] = useState<LoanApplication[]>([]);
  const [loansLoaded, setLoansLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'borrower') { router.push('/dashboard'); return; }
    api.get<LoanApplication[]>('/loans/my-loans')
      .then(({ data }) => setMyLoans(data))
      .catch(error => setError(getApiErrorMessage(error, 'Unable to load your loan applications.')))
      .finally(() => setLoansLoaded(true));
  }, [user, loaded, router]);

  const si = (loanAmount * 12 * tenure) / (365 * 100);
  const totalRepayment = Math.round(loanAmount + si);

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post<{ loanId: string }>('/loans/personal-details', { ...personal, monthlySalary: Number(personal.monthlySalary) });
      setLoanId(data.loanId);
      setStep(2);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Unable to save your personal details.'));
    } finally { setLoading(false); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    if (!file) { setError('Please select a file'); setLoading(false); return; }
    const fd = new FormData();
    fd.append('salarySlip', file);
    try {
      await api.post(`/loans/upload-salary-slip/${loanId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStep(3);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Salary slip upload failed.'));
    } finally { setLoading(false); }
  };

  const handleApply = async () => {
    setError(''); setLoading(true);
    try {
      const { data } = await api.post<{ loan: LoanApplication }>(`/loans/apply/${loanId}`, { loanAmount, tenure });
      setAppliedLoan(data.loan);
      setStep(4);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Loan application failed.'));
    } finally { setLoading(false); }
  };

  const statusColor: Record<LoanStatus, string> = {
    applied: 'bg-yellow-100 text-yellow-700',
    sanctioned: 'bg-blue-100 text-blue-700',
    disbursed: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
    rejected: 'bg-red-100 text-red-600',
  };

  if (!loaded) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400 text-sm">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-700">LMS — Borrower Portal</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
          <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto mt-10 px-4">
        {loansLoaded && myLoans.length > 0 && step === 1 && !appliedLoan && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
            <h2 className="text-base font-semibold text-gray-700 mb-3">Your Loan Applications</h2>
            <div className="space-y-2">
              {myLoans.map(l => (
                <div key={l._id} className="flex flex-wrap justify-between items-center text-sm bg-gray-50 rounded-lg px-4 py-3 gap-2">
                  <span className="text-gray-600">₹{l.loanAmount?.toLocaleString() ?? '—'}</span>
                  <span className="text-gray-400">{l.tenure ? `${l.tenure} days` : '—'}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${statusColor[l.status]}`}>{l.status}</span>
                  {l.rejectionReason && <span className="text-xs text-red-400">{l.rejectionReason}</span>}
                </div>
              ))}
            </div>
            <button onClick={() => setMyLoans([])} className="mt-4 text-sm text-blue-600 hover:underline">+ Apply for a new loan</button>
          </div>
        )}

        {/* Stepper */}
        {(myLoans.length === 0 || appliedLoan) && (
          <>
            <div className="flex items-center mb-8">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`ml-2 text-xs hidden sm:block ${step === i + 1 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{s}</span>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>

            {error && <p className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</p>}

            {step === 1 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Personal Details</h2>
                <form onSubmit={handlePersonalSubmit} className="space-y-4">
                  <Field label="Full Name">
                    <input required value={personal.fullName} onChange={e => setPersonal({ ...personal, fullName: e.target.value })} className={inp} placeholder="As per PAN card" />
                  </Field>
                  <Field label="PAN Number">
                    <input required value={personal.pan} onChange={e => setPersonal({ ...personal, pan: e.target.value.toUpperCase() })} className={inp} placeholder="ABCDE1234F" maxLength={10} />
                  </Field>
                  <Field label="Date of Birth">
                    <input type="date" required value={personal.dob} onChange={e => setPersonal({ ...personal, dob: e.target.value })} className={inp} />
                  </Field>
                  <Field label="Monthly Salary (₹)">
                    <input type="number" required value={personal.monthlySalary} onChange={e => setPersonal({ ...personal, monthlySalary: e.target.value })} className={inp} placeholder="e.g. 50000" />
                  </Field>
                  <Field label="Employment Mode">
                    <select value={personal.employmentMode} onChange={e => setPersonal({ ...personal, employmentMode: e.target.value })} className={inp}>
                      <option value="salaried">Salaried</option>
                      <option value="self-employed">Self-Employed</option>
                      <option value="unemployed">Unemployed</option>
                    </select>
                  </Field>
                  <button type="submit" disabled={loading} className={btn}>{loading ? 'Checking...' : 'Continue'}</button>
                </form>
              </div>
            )}

            {step === 2 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Upload Salary Slip</h2>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" id="slip" />
                    <label htmlFor="slip" className="cursor-pointer">
                      <p className="text-gray-500 text-sm">Click to upload PDF, JPG, or PNG (max 5MB)</p>
                      {file && <p className="mt-2 text-blue-600 font-medium text-sm">{file.name}</p>}
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)} className={btnOutline}>Back</button>
                    <button type="submit" disabled={loading} className={btn}>{loading ? 'Uploading...' : 'Continue'}</button>
                  </div>
                </form>
              </div>
            )}

            {step === 3 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Loan Configuration</h2>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Loan Amount</label>
                      <span className="text-blue-600 font-semibold">₹{loanAmount.toLocaleString()}</span>
                    </div>
                    <input type="range" min={50000} max={500000} step={5000} value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} className="w-full accent-blue-600" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1"><span>₹50,000</span><span>₹5,00,000</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Tenure</label>
                      <span className="text-blue-600 font-semibold">{tenure} days</span>
                    </div>
                    <input type="range" min={30} max={365} step={1} value={tenure} onChange={e => setTenure(Number(e.target.value))} className="w-full accent-blue-600" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1"><span>30 days</span><span>365 days</span></div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Principal</span><span className="font-medium">₹{loanAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Interest Rate</span><span className="font-medium">12% p.a.</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Tenure</span><span className="font-medium">{tenure} days</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Simple Interest</span><span className="font-medium">₹{Math.round(si).toLocaleString()}</span></div>
                    <div className="flex justify-between border-t pt-2 font-semibold text-blue-700"><span>Total Repayment</span><span>₹{totalRepayment.toLocaleString()}</span></div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)} className={btnOutline}>Back</button>
                    <button onClick={handleApply} disabled={loading} className={btn}>{loading ? 'Applying...' : 'Apply for Loan'}</button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && appliedLoan && (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
                <p className="text-gray-500 text-sm mb-4">Your loan application is under review.</p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-left space-y-2">
                  <div className="flex justify-between"><span className="text-gray-500">Loan ID</span><span className="font-mono text-xs">{appliedLoan._id}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Amount</span><span>₹{appliedLoan.loanAmount?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Repayment</span><span>₹{appliedLoan.totalRepayment?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Status</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${statusColor[appliedLoan.status]}`}>{appliedLoan.status}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}</div>;
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
const btn = 'flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm';
const btnOutline = 'flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition text-sm';
