'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Plus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type NavRole = 'admin' | 'developer' | 'guest' | 'loading';

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [navRole, setNavRole] = useState<NavRole>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [initials, setInitials] = useState('');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const avatarRef = useRef<HTMLDivElement>(null);

  const hiddenPaths = ['/login', '/auth'];
  const isHidden = hiddenPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (isHidden) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setNavRole('guest');
        setUserId(null);
        return;
      }
      setUserId(user.id);
      const email = user.email ?? '';
      const parts = email.split('@')[0].split(/[._-]/);
      const ini =
        parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : email.slice(0, 2).toUpperCase();
      setInitials(ini);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setNavRole(profile?.role === 'admin' ? 'admin' : 'developer');

      if (profile?.role !== 'admin') {
        const { data: published } = await supabase.from('versions').select('id').eq('status', 'published');
        const { data: done } = await supabase
          .from('integration_completions')
          .select('version_id')
          .eq('user_id', user.id)
          .eq('status', 'completed');
        const doneIds = new Set((done ?? []).map((r) => r.version_id));
        const needsAttention = (published ?? []).filter((v) => !doneIds.has(v.id)).length;
        if (!cancelled) setUnreadCount(needsAttention);
      } else {
        if (!cancelled) setUnreadCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, isHidden, pathname]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    setHeaderReady(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  if (isHidden) return null;

  const showScrollStyle = headerReady && scrolled;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isAdmin = navRole === 'admin';
  const isLoggedIn = navRole === 'admin' || navRole === 'developer';

  const tabClass = (active: boolean) =>
    `relative px-3 py-1.5 rounded-lg text-sm transition-colors min-w-[auto] ${
      active
        ? 'text-slate-100 bg-white/[0.08]'
        : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
    }`;

  return (
    <header
      className={`sticky top-0 z-10 border-b transition-[background-color,backdrop-filter,border-color] duration-300 ease-out ${
        showScrollStyle
          ? 'bg-slate-950/80 backdrop-blur-xl backdrop-saturate-150 border-white/[0.08]'
          : 'bg-transparent border-white/[0.06]'
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/changelog" className="flex items-center gap-2.5 shrink-0">
            <span className="text-sm font-semibold text-slate-200 tracking-tight">DS Tracker</span>
            <span className="text-slate-500">/</span>
            <span className="text-sm text-slate-400">Real Estate UI</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            <Link
              href="/changelog"
              className={tabClass(pathname.startsWith('/changelog'))}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Changelog</span>
                {!isAdmin && unreadCount > 0 && (
                  <span
                    className="shrink-0 w-2 h-2 rounded-full bg-orange-400 animate-pulse"
                    style={{ boxShadow: '0 0 8px rgba(251,146,60,0.6)' }}
                    aria-hidden
                  />
                )}
              </span>
            </Link>
            {isAdmin && (
              <Link
                href="/settings/team"
                className={tabClass(pathname.startsWith('/settings'))}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Équipe
                </span>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Nouveau changelog
            </Link>
          )}

          {isLoggedIn && (
            <div ref={avatarRef} className="relative">
              <button
                type="button"
                onClick={() => setAvatarOpen(!avatarOpen)}
                className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.1] text-[11px] font-semibold text-slate-300 flex items-center justify-center hover:bg-white/[0.14] transition-colors cursor-pointer"
              >
                {initials}
              </button>

              {avatarOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-slate-900 border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 py-1 z-50">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
