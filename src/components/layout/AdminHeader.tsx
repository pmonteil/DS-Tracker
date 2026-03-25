'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-10 bg-transparent border-b border-white/[0.06]">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-200">DS Tracker</span>
            <span className="text-slate-600">/</span>
            <span className="text-sm text-slate-500">Real Estate UI</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname === '/'
                  ? 'text-slate-100 bg-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
            >
              Admin
            </Link>
            <Link
              href="/changelog"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith('/changelog')
                  ? 'text-slate-100 bg-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
            >
              Changelog
            </Link>
            <Link
              href="/settings/team"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith('/settings')
                  ? 'text-slate-100 bg-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                Équipe
              </span>
            </Link>
          </nav>
        </div>

        {ready && (
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-white/[0.06]"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            <span>Déconnexion</span>
          </button>
        )}
      </div>
    </header>
  );
}
