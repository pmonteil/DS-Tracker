'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader } from '@/components/ui/Loader';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setIsAuth(true);
      setIsLoading(false);
    };
    checkAuth();
  }, [router, supabase.auth]);

  if (isLoading) return <Loader message="Chargement..." />;
  if (!isAuth) return null;

  return <>{children}</>;
}
