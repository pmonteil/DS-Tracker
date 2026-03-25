'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, User, Check, X, Ban, Undo2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AdminGuard } from '@/components/layout/AdminGuard';
import { AppHeader } from '@/components/layout/AppHeader';
import { Loader } from '@/components/ui/Loader';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'developer';
  status: 'pending' | 'active' | 'revoked';
  created_at: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/admin/team');
    const data = await res.json();
    setMembers(data.members ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const updateStatus = async (userId: string, status: 'active' | 'revoked') => {
    setActionLoading(userId);
    await fetch(`/api/admin/team/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await fetchMembers();
    setActionLoading(null);
  };

  const deleteUser = async (userId: string) => {
    setActionLoading(userId);
    await fetch(`/api/admin/team/${userId}`, { method: 'DELETE' });
    await fetchMembers();
    setActionLoading(null);
  };

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const revoked = members.filter((m) => m.status === 'revoked');

  function getInitials(member: TeamMember): string {
    if (member.full_name) {
      const parts = member.full_name.trim().split(/\s+/);
      return parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : member.full_name.slice(0, 2).toUpperCase();
    }
    return member.email.slice(0, 2).toUpperCase();
  }

  function MemberRow({ member, actions }: { member: TeamMember; actions: React.ReactNode }) {
    const isProcessing = actionLoading === member.id;

    return (
      <div className="group/member flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
            {member.role === 'admin' ? (
              <Shield className="h-3.5 w-3.5 text-blue-400" strokeWidth={1.5} />
            ) : (
              <span className="text-[11px] font-semibold text-slate-300">
                {getInitials(member)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {member.full_name || member.email.split('@')[0]}
            </p>
            <p className="text-xs text-slate-400 truncate">{member.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
            member.role === 'admin'
              ? 'bg-blue-500/[0.12] text-blue-400'
              : 'bg-white/[0.06] text-slate-400'
          }`}>
            {member.role === 'admin' ? 'Admin' : 'Dev'}
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            {formatDistanceToNow(new Date(member.created_at), { addSuffix: true, locale: fr })}
          </span>
          {isProcessing ? (
            <span className="text-xs text-slate-400">...</span>
          ) : (
            <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen">
        <AppHeader />
        <main className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-lg font-medium text-slate-100 mb-1">Équipe</h1>
          <p className="text-sm text-slate-500 mb-8">
            Gérez les accès au Design System Tracker
          </p>

          {loading ? (
            <Loader message="Chargement..." />
          ) : (
            <div className="space-y-8">
              {/* Demandes en attente */}
              {pending.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="relative shrink-0">
                      <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-40" />
                      <span className="relative block w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <span className="text-[13px] font-medium text-slate-300">
                      Demandes en attente
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/[0.12] text-amber-400 font-medium">
                      {pending.length}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                    {pending.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        actions={
                          <>
                            <button
                              type="button"
                              onClick={() => updateStatus(member.id, 'active')}
                              className="p-1.5 rounded-lg hover:bg-emerald-500/[0.12] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Approuver"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUser(member.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/[0.12] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                              title="Rejeter"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Membres actifs */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[13px] font-medium text-slate-300">
                    Membres actifs
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 font-medium">
                    {active.length}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                {active.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Aucun membre</p>
                ) : (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                    {active.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        actions={
                          member.role !== 'admin' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => updateStatus(member.id, 'revoked')}
                                className="p-1.5 rounded-lg hover:bg-amber-500/[0.12] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                                title="Révoquer l'accès"
                              >
                                <Ban className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteUser(member.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/[0.12] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </button>
                            </>
                          ) : null
                        }
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Accès révoqués */}
              {revoked.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                    <span className="text-[13px] font-medium text-slate-400">
                      Accès révoqués
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 font-medium">
                      {revoked.length}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>

                  <div className="bg-white/[0.015] border border-white/[0.04] rounded-xl divide-y divide-white/[0.03]">
                    {revoked.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        actions={
                          <>
                            <button
                              type="button"
                              onClick={() => updateStatus(member.id, 'active')}
                              className="p-1.5 rounded-lg hover:bg-emerald-500/[0.12] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Réactiver"
                            >
                              <Undo2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUser(member.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/[0.12] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                              title="Supprimer définitivement"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
