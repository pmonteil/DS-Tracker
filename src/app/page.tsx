'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/layout/AdminGuard';
import { BranchList } from '@/components/branches/BranchList';
import { Loader } from '@/components/ui/Loader';
import type { FigmaBranch } from '@/lib/types';

const PROGRESS_MESSAGES = [
  'Récupération des données Figma...',
  'Calcul des différences...',
  'Génération du patchnote via IA...',
  'Préparation des screenshots...',
  'Finalisation...',
];

export default function AdminHome() {
  const [comparing, setComparing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const router = useRouter();

  const handleCompare = async (branch: FigmaBranch) => {
    setComparing(true);
    setProgressMsg(PROGRESS_MESSAGES[0]);

    let msgIndex = 0;
    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, PROGRESS_MESSAGES.length - 1);
      setProgressMsg(PROGRESS_MESSAGES[msgIndex]);
    }, 4000);

    try {
      const res = await fetch('/api/diff/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchKey: branch.key,
          branchName: branch.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.version?.id) {
        router.push(`/versions/${data.version.id}/edit`);
      }
    } catch (err) {
      console.error('Compare failed:', err);
      alert('Erreur lors de la comparaison. Vérifiez la console.');
    } finally {
      clearInterval(interval);
      setComparing(false);
      setProgressMsg('');
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-screen">
        <main className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-lg font-medium text-slate-100 mb-1">Nouveau changelog</h1>
          <p className="text-sm text-slate-300 mb-8">
            Sélectionnez une branche Figma pour comparer les changements avec main.
          </p>

          {comparing ? (
            <Loader message={progressMsg} />
          ) : (
            <BranchList onCompare={handleCompare} comparing={comparing} />
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
