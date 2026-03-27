'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTeamByValue } from '@/lib/teams';

interface CompletedAvatarsProps {
  versionId: string;
}

interface CompletedUser {
  full_name: string | null;
  email: string;
  team: string | null;
}

export function CompletedAvatars({ versionId }: CompletedAvatarsProps) {
  const [users, setUsers] = useState<CompletedUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data: completions } = await supabase
        .from('integration_completions')
        .select('user_id')
        .eq('version_id', versionId)
        .eq('status', 'completed');

      if (cancelled || !completions || completions.length === 0) return;

      const userIds = completions.map((c) => c.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('full_name, email, team')
        .in('id', userIds);

      if (cancelled) return;
      setUsers((profiles as CompletedUser[]) ?? []);
    })();

    return () => { cancelled = true; };
  }, [versionId]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
      <div className="flex -space-x-1.5">
        {users.map((user, i) => {
          const team = getTeamByValue(user.team ?? 'autre');
          const initial = (user.full_name || user.email || '?')[0].toUpperCase();

          return (
            <div key={i} className="group/avatar relative">
              <div className="relative">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-slate-950 cursor-default transition-transform hover:scale-110 hover:z-10"
                  style={{ backgroundColor: team.color }}
                >
                  {initial}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 ring-[1.5px] ring-slate-950">
                  <svg className="w-[7px] h-[7px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>

              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-3 py-2 bg-slate-800 text-white text-xs rounded-xl whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-opacity shadow-xl border border-white/10 z-50">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="font-semibold text-[11px]" style={{ color: team.color }}>
                    {team.label}
                  </span>
                </div>
                <div className="text-slate-300 mt-0.5">
                  {user.full_name || user.email}
                  <span className="text-slate-500 ml-1">a intégré</span>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                  <div className="w-2 h-2 bg-slate-800 border-r border-b border-white/10 rotate-45" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
