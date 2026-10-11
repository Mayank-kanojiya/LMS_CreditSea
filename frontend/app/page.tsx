'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, loaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) return;
    if (!user) router.push('/login');
    else if (user.role === 'borrower') router.push('/apply');
    else router.push('/dashboard');
  }, [user, loaded, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  );
}
