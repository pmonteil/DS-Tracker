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
    const supabase = createClient();
    supabase
      .from('integration_completions')
      .select('user_id, profiles:user_id (full_name, email, team)')
      .eq('version_id', versionId)
      .eq('status', 'completed')
      .then(({ data }) => {
        if (data) {
          const parsed = data
            .map((d: Record<string, unknown>) => d.profiles as CompletedUser | null)
            .filter(Boolean) as CompletedUser[];
          setUsers(parsed);
        }
      });
  }, [versionId]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {users.map((user, i) => {
          const team = getTeamByValue(user.team ?? 'autre');
          const initial = (user.full_name || user.email || '?')[0].toUpperCase();

          return (
            <div key={i} className="group/avatar relative">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-slate-950 cursor-default transition-transform hover:scale-110 hover:z-10"
                style={{ backgroundColor: team.color }}
              >
                {initial}
              </div>

              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-opacity shadow-lg border border-white/10 z-50">
                <span className="font-medium">{user.full_name || user.email}</span>
                <span className="text-slate-400 ml-1.5">· {team.label}</span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                  <div className="w-2 h-2 bg-slate-800 border-r border-b border-white/10 rotate-45" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <span className="text-xs text-slate-500 ml-2">
        {users.length} intégration{users.length > 1 ? 's' : ''} terminée{users.length > 1 ? 's' : ''}
      </span>
    </div>
  );
}
