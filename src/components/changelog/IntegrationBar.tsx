'use client';

interface IntegrationBarProps {
  totalItems: number;
  completedItems: number;
  onComplete: () => void;
  isCompleted: boolean;
  onReopen: () => void;
}

export function IntegrationBar({
  totalItems,
  completedItems,
  onComplete,
  isCompleted,
  onReopen,
}: IntegrationBarProps) {
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (completedItems === 0 && !isCompleted) return null;

  return (
    <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/[0.06] px-6 py-4 z-40">
      <div className="max-w-3xl mx-auto flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>
              {completedItems}/{totalItems} intégrés
            </span>
            <span>{percentage}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {isCompleted ? (
          <button
            type="button"
            onClick={onReopen}
            className="px-4 py-2 bg-white/[0.08] text-slate-200 rounded-xl text-sm border border-white/10 hover:bg-white/[0.12] transition-colors cursor-pointer"
          >
            Rouvrir
          </button>
        ) : percentage === 100 ? (
          <button
            type="button"
            onClick={onComplete}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors cursor-pointer"
          >
            Clôturer l&apos;intégration
          </button>
        ) : null}
      </div>
    </div>
  );
}
