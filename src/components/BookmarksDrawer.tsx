import React, { useState } from 'react';
import { Bookmark, ExternalLink, Search, Trash2, X } from 'lucide-react';
import { BookmarkEntry } from '../types';
import { isSafeHttpUrl } from '../lib/searchHelpers';

interface BookmarksDrawerProps {
  isOpen: boolean;
  bookmarks: BookmarkEntry[];
  onClose: () => void;
  onRemoveBookmark: (url: string) => void;
  onOpenUrl: (url: string, title?: string) => void;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  bookmarks,
  onClose,
  onRemoveBookmark,
  onOpenUrl,
}) => {
  const [filter, setFilter] = useState('');

  if (!isOpen) return null;

  const filtered = bookmarks.filter((b) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.displayLink.toLowerCase().includes(q) ||
      b.snippet.toLowerCase().includes(q)
    );
  });

  const sourceLabel = (source: BookmarkEntry['sourceType']) => {
    switch (source) {
      case 'google':
        return 'Google';
      case 'duckduckgo':
        return 'DuckDuckGo';
      case 'wiki':
        return 'ويكيبيديا';
      case 'drive':
        return 'Google Drive';
      case 'ai':
        return 'ملخص نوفا';
      default:
        return 'ويب';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div
        className="w-full max-w-md bg-white dark:bg-[#202124] h-full border-r border-[#dadce0] dark:border-[#3c4043] shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="المفضلة"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaed] dark:border-[#3c4043]">
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-5 h-5 text-[#1a73e8] dark:text-[#8ab4f8]" />
            <h2 className="text-lg font-bold text-[#202124] dark:text-[#e8eaed]">
              المفضلة المحفوظة
            </h2>
            <span className="text-xs font-mono tabular-nums text-[#5f6368] dark:text-[#9aa0a6]">
              ({bookmarks.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المفضلة"
            className="p-2 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[#e8eaed] dark:border-[#3c4043]">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#f1f3f4] dark:bg-[#303134]">
            <Search className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6]" />
            <input
              type="text"
              dir="auto"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="تصفية النتائج المحفوظة..."
              className="flex-1 bg-transparent text-sm text-[#202124] dark:text-[#e8eaed] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-10 h-10 mx-auto text-[#bdc1c6] dark:text-[#5f6368] mb-3" />
              <p className="text-sm font-medium text-[#202124] dark:text-[#e8eaed]">
                {bookmarks.length === 0 ? 'لا توجد نتائج محفوظة بعد' : 'لا توجد نتائج مطابقة'}
              </p>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1">
                اضغط على أيقونة النجمة بجانب أي نتيجة بحث لحفظها هنا.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-[#e8eaed] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#28292c] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6] mb-1">
                      <span dir="ltr" className="truncate">
                        {item.displayLink}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{sourceLabel(item.sourceType)}</span>
                    </div>
                    {isSafeHttpUrl(item.url) ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            onClose();
                            onOpenUrl(item.url, item.title);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a0dab] dark:text-[#8ab4f8] hover:underline"
                      >
                        <span dir="auto" className="line-clamp-2">
                          {item.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-[#202124] dark:text-[#e8eaed]">
                        {item.title}
                      </span>
                    )}
                    {item.snippet && (
                      <p dir="auto" className="mt-1.5 text-xs text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2 leading-relaxed">
                        {item.snippet}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveBookmark(item.url)}
                    title="إزالة من المفضلة"
                    aria-label="إزالة من المفضلة"
                    className="p-1.5 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#d93025] dark:hover:text-[#f28b82] hover:bg-[#fce8e6] dark:hover:bg-[#3c1e1e] transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
