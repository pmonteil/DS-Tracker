'use client';

import { useState, useEffect } from 'react';
import { Loader } from '@/components/ui/Loader';
import { VersionCard } from './VersionCard';
import type { Version } from '@/lib/types';

interface VersionListProps {
  isAdmin?: boolean;
  statusFilter?: 'draft' | 'published';
}

export function VersionList({ isAdmin, statusFilter }: VersionListProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (!isAdmin) params.set('public', 'true');

      const res = await fetch(`/api/versions?${params}`);
      const data = await res.json();
      setVersions(data.versions ?? []);
      setLoading(false);
    };
    fetchVersions();
  }, [isAdmin, statusFilter]);

  if (loading) return <Loader message="Chargement des patchnotes..." />;

  if (versions.length === 0) {
    return (
      <p className="text-sm text-slate-300 text-center py-8">
        Aucun patchnote pour le moment
      </p>
    );
  }

  const sorted = [...versions].sort((a, b) => {
    if (a.status === 'draft' && b.status !== 'draft') return -1;
    if (a.status !== 'draft' && b.status === 'draft') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const latestPublishedId = sorted.find((v) => v.status === 'published')?.id ?? null;

  return (
    <div className="space-y-0.5">
      {sorted.map((version) => (
        <VersionCard
          key={version.id}
          version={version}
          isAdmin={isAdmin}
          isLatestPublished={version.id === latestPublishedId}
        />
      ))}
    </div>
  );
}
