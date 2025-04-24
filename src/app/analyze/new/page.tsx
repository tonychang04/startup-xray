'use client';

import { useAuth } from '@/hooks/useAuth';
import AnalysisForm from '@/components/forms/AnalysisForm';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewAnalysisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/analyze/new');
    }
  }, [user, loading, router]);
  
  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  
  if (!user) {
    return null; // Will redirect in useEffect
  }
  
  return <AnalysisForm />;
} 