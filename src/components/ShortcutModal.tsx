import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { isSafeHttpUrl, normalizeUrl } from '../lib/searchHelpers';

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, url: string, iconColor: string) => void;
}

const COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#9334E6', '#00897B'];

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const normalized = normalizeUrl(url);
    if (!cleanTitle) {
      setError('يرجى إدخال اسم الاختصار.');
      return;
    }
    if (!isSafeHttpUrl(normalized)) {
      setError('يرجى إدخال رابط موقع صالح (يبدأ بـ https://).');
      return;
    }
    onAdd(cleanTitle, normalized, color);
    setTitle('');
    setUrl('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إضافة اختصار سريع"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#202124] rounded-3xl border border-[#dadce0] dark:border-[#3c4043] shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#202124] dark:text-[#e8eaed]">
            إضافة اختصار جديد
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] mb-1.5">
              اسم الموقع
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: ويكيبيديا"
              className="w-full px-4 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#303134] text-sm text-[#202124] dark:text-[#e8eaed] focus:outline-none focus:border-[#1a73e8]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] mb-1.5">
              الرابط (URL)
            </label>
            <input
              type="text"
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ar.wikipedia.org"
              className="w-full px-4 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#303134] text-sm text-[#202124] dark:text-[#e8eaed] text-right focus:outline-none focus:border-[#1a73e8]"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] mb-2">
              لون الأيقونة
            </span>
            <div className="flex items-center gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full cursor-pointer ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#1a73e8] dark:ring-offset-[#202124]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-[#d93025] dark:text-[#f28b82]">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#202124] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
