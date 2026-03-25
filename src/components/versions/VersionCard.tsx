'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Version } from '@/lib/types';

interface VersionCardProps {
  version: Version;
  isAdmin?: boolean;
  isLatestPublished?: boolean;
}

export function VersionCard({ version, isAdmin, isLatestPublished }: VersionCardProps) {
  const href = isAdmin
    ? `/versions/${version.id}/edit`
    : `/changelog/${version.version_number}`;

  const isDraft = version.status === 'draft';
  const isPublished = version.status === 'published';

  return (
    <Link href={href}>
      <div
        className={`flex items-center gap-4 py-3.5 px-4 rounded-xl transition-all ${
          isAdmin
            ? 'hover:bg-white/[0.04]'
            : 'hover:bg-gray-50'
        }`}
      >
        {/* Status dot */}
        <div className="relative shrink-0">
          {isDraft && (
            <>
              <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-40" />
              <span className="relative block w-2.5 h-2.5 rounded-full bg-blue-400" />
            </>
          )}
          {isPublished && isLatestPublished && (
            <>
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
              <span className="relative block w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </>
          )}
          {isPublished && !isLatestPublished && (
            <span className="block w-2.5 h-2.5 rounded-full bg-slate-500" />
          )}
        </div>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className={`text-sm font-mono font-medium shrink-0 ${
              isAdmin ? 'text-slate-200' : 'text-gray-900'
            }`}
          >
            {version.version_number}
          </span>
          <span
            className={`text-sm truncate ${
              isAdmin ? 'text-slate-300' : 'text-gray-500'
            }`}
          >
            {version.title}
          </span>
        </div>

        <span
          className={`text-xs shrink-0 ${
            isAdmin ? 'text-slate-400' : 'text-gray-400'
          }`}
        >
          {formatDistanceToNow(new Date(version.created_at), {
            addSuffix: true,
            locale: fr,
          })}
        </span>
      </div>
    </Link>
  );
}
