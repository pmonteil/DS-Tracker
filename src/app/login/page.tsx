'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeamSelect } from '@/components/ui/TeamSelect';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [team, setTeam] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Identifiants incorrects');
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile || profile.status !== 'active') {
        await supabase.auth.signOut();
        if (profile?.status === 'revoked') {
          setError("Votre accès a été révoqué. Contactez un administrateur.");
        } else {
          setError('Votre demande est en cours de validation par un administrateur.');
        }
        setLoading(false);
        return;
      }
    }

    router.push('/changelog');
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!fullName.trim()) {
      setError('Le prénom est requis');
      setLoading(false);
      return;
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (signupError) {
      setError(
        signupError.message.includes('already registered')
          ? 'Cet email est déjà utilisé'
          : signupError.message,
      );
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase
        .from('profiles')
        .update({ team: team || 'autre' })
        .eq('id', data.user.id);
    }

    await supabase.auth.signOut();

    setSuccess(
      'Demande envoyée ! Un administrateur doit valider votre accès avant que vous puissiez vous connecter.',
    );
    setEmail('');
    setPassword('');
    setFullName('');
    setTeam('');
    setLoading(false);
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-white/[0.28] transition-colors';

  return (
    <div className="min-h-screen flex items-start justify-center pt-[18vh]">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">DS Tracker</h1>
          <p className="text-sm text-slate-400 mt-1">Real Estate UI</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex mb-6 bg-white/[0.04] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white/[0.08] text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm rounded-md transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white/[0.08] text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Demander un accès
            </button>
          </div>

          <div className="min-h-[340px]">
            <form
              onSubmit={mode === 'login' ? handleLogin : handleSignup}
              className="flex flex-col gap-4"
            >
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Prénom</label>
                  <input
                    type="text"
                    placeholder="Jean"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Équipe</label>
                  <TeamSelect value={team} onChange={setTeam} />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400 bg-red-500/[0.08] border border-red-500/[0.15] rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-sm text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/[0.15] rounded-xl px-3 py-2">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 py-2.5 bg-white text-slate-900 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? '...'
                  : mode === 'login'
                    ? 'Se connecter'
                    : 'Envoyer ma demande'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
