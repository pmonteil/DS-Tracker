'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type NavRole = 'admin' | 'developer' | 'guest' | 'loading';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [navRole, setNavRole] = useState<NavRole>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setNavRole('guest');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.role === 'admin') {
        setNavRole('admin');
      } else {
        setNavRole('developer');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isAdmin = navRole === 'admin';
  const showLogout = navRole === 'admin' || navRole === 'developer';
  const homeHref = isAdmin ? '/' : '/changelog';

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={homeHref} className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">DS Tracker</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Real Estate UI</span>
          </Link>

          <nav className="flex items-center gap-1">
            {isAdmin && (
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  pathname === '/'
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Admin
              </Link>
            )}
            <Link
              href="/changelog"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith('/changelog')
                  ? 'text-gray-900 bg-gray-100'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Changelog
            </Link>
            {isAdmin && (
              <Link
                href="/settings/team"
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  pathname.startsWith('/settings')
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Équipe
                </span>
              </Link>
            )}
          </nav>
        </div>

        {showLogout && (
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            <span>Déconnexion</span>
          </button>
        )}
      </div>
    </header>
  );
}
