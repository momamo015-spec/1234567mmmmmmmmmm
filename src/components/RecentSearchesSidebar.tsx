import React from 'react';
import { ArrowUpLeft, Clock, History, Search } from 'lucide-react';
import { SearchHistoryEntry, SearchTab } from '../types';

interface RecentSearchesSidebarProps {
  history: SearchHistoryEntry[];
  isGuest?: boolean;
  onSelectSearch: (entry: SearchHistoryEntry) => void;
  onClearHistory?: () => void;
}

const TAB_LABELS: Record<SearchTab, string> = {
  all: 'الكل',
  images: 'الصور',
  videos: 'الفيديو',
  news: 'الأخبار',
  drive: 'ملفات Drive',
};

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `منذ ${diffHour} س`;
  return new Date(timestamp).toLocaleDateString('ar-EG', {
    month: 'short',
    day: 'numeric',
  });
}

export const RecentSearchesSidebar: React.FC<RecentSearchesSidebarProps> = ({
  history,
  isGuest = false,
  onSelectSearch,
  onClearHistory,
}) => {
  const recentItems = history.slice(0, 5);

  return (
    <aside
      aria-label="آخر عمليات البحث"
      className="w-full rounded-2xl border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] overflow-hidden"
    >
      {/* Sidebar Header */}
      <div className="px-4 py-3.5 border-b border-[#ebebeb] dark:border-[#3c4043] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-[#1a73e8] dark:text-[#8ab4f8] shrink-0" />
          <h2 className="text-sm font-bold text-[#202124] dark:text-[#e8eaed] truncate">
            آخر عمليات البحث
          </h2>
        </div>

        {!isGuest && recentItems.length > 0 && onClearHistory && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#d93025] dark:hover:text-[#f28b82] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            مسح السجل
          </button>
        )}
      </div>

      {/* Body */}
      {isGuest ? (
        <div className="px-4 py-7 text-center">
          <Clock className="w-7 h-7 mx-auto text-[#9aa0a6] mb-2" />
          <p className="text-xs font-medium text-[#202124] dark:text-[#e8eaed]">
            وضع التصفح الخفي نشط
          </p>
          <p className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] mt-1 leading-relaxed">
            لا يتم حفظ سجل البحث في وضع الضيف للحفاظ على خصوصيتك.
          </p>
        </div>
      ) : recentItems.length === 0 ? (
        <div className="px-4 py-7 text-center">
          <Search className="w-7 h-7 mx-auto text-[#bdc1c6] dark:text-[#5f6368] mb-2" />
          <p className="text-xs font-medium text-[#202124] dark:text-[#e8eaed]">
            لا توجد عمليات بحث سابقة بعد
          </p>
          <p className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] mt-1 leading-relaxed tabular-nums">
            ستظهر هنا آخر 5 عمليات بحث لإعادة تنفيذها بنقرة واحدة.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
          {recentItems.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelectSearch(entry)}
                title={`إعادة البحث عن: ${entry.query}`}
                className="group w-full px-4 py-3 flex items-center justify-between gap-3 text-right hover:bg-[#f8f9fa] dark:hover:bg-[#28292c] transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Clock className="w-3.5 h-3.5 text-[#9aa0a6] group-hover:text-[#1a73e8] dark:group-hover:text-[#8ab4f8] mt-1 shrink-0 transition-colors" />
                  <div className="min-w-0 flex-1">
                    <p
                      dir="auto"
                      className="text-xs sm:text-sm font-medium text-[#202124] dark:text-[#e8eaed] group-hover:text-[#1a73e8] dark:group-hover:text-[#8ab4f8] truncate transition-colors"
                    >
                      {entry.query}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] dark:text-[#9aa0a6] mt-0.5 tabular-nums">
                      <span>{TAB_LABELS[entry.tab] || 'الكل'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(entry.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <ArrowUpLeft className="w-4 h-4 text-[#9aa0a6] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:text-[#1a73e8] dark:group-hover:text-[#8ab4f8] transition-opacity shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};
