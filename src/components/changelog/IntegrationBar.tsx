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

  return (
    <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/[0.06] px-5 py-2.5 sm:px-6 z-40">
      <div className="max-w-5xl mx-auto flex items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="text-slate-500">Mon intégration</span>
              <span className="text-slate-300 font-medium">{completedItems}/{totalItems}</span>
            </span>
            <span className={percentage === 100 ? 'text-slate-100 font-medium' : ''}>{percentage}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted ? (
            <button
              type="button"
              onClick={onReopen}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-white/[0.08] text-slate-200 rounded-xl text-sm border border-white/10 hover:bg-white/[0.12] transition-colors cursor-pointer whitespace-nowrap"
            >
              Rouvrir
            </button>
          ) : (
            percentage === 100 && (
              <button
                type="button"
                onClick={onComplete}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-white text-slate-900 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Clôturer l&apos;intégration
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
