'use client';

import Link from 'next/link';
import type { Version } from '@/lib/types';

interface VersionSidebarProps {
  versions: Version[];
  currentVersionNumber?: string;
}

export function VersionSidebar({ versions, currentVersionNumber }: VersionSidebarProps) {
  return (
    <aside className="w-56 shrink-0">
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
        Toutes les versions
      </h3>
      <nav className="space-y-0.5">
        {versions.map((v) => (
          <Link
            key={v.id}
            href={`/changelog/${v.version_number}`}
            className={`block px-3 py-1.5 text-sm rounded-lg transition-colors ${
              v.version_number === currentVersionNumber
                ? 'bg-white/[0.08] text-slate-100 font-medium'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {v.version_number}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
