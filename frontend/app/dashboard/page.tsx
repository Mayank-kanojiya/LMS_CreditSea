'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

const ROLE_MODULES: Record<string, { label: string; href: string; color: string }[]> = {
  admin: [
    { label: 'Sales', href: '/dashboard/sales', color: 'bg-purple-100 text-purple-700' },
    { label: 'Sanction', href: '/dashboard/sanction', color: 'bg-blue-100 text-blue-700' },
    { label: 'Disbursement', href: '/dashboard/disbursement', color: 'bg-green-100 text-green-700' },
    { label: 'Collection', href: '/dashboard/collection', color: 'bg-orange-100 text-orange-700' },
  ],
  sales: [{ label: 'Sales', href: '/dashboard/sales', color: 'bg-purple-100 text-purple-700' }],
  sanction: [{ label: 'Sanction', href: '/dashboard/sanction', color: 'bg-blue-100 text-blue-700' }],
  disbursement: [{ label: 'Disbursement', href: '/dashboard/disbursement', color: 'bg-green-100 text-green-700' }],
  collection: [{ label: 'Collection', href: '/dashboard/collection', color: 'bg-orange-100 text-orange-700' }],
};

export default function DashboardPage() {
  const { user, loaded, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) return;
    if (!user) { router.push('/login'); return; }
    if (user.role === 'borrower') router.push('/apply');
  }, [user, loaded, router]);

  const modules = ROLE_MODULES[user?.role || ''] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-700">LMS — Operations Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name} <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs ml-1 capitalize">{user?.role}</span></span>
          <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto mt-10 px-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-6">Your Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map(m => (
            <Link key={m.href} href={m.href}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${m.color}`}>
                {m.label[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{m.label}</p>
                <p className="text-sm text-gray-400">Manage {m.label.toLowerCase()} operations</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
