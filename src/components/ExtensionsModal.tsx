import React, { useState } from 'react';
import {
  Check,
  Download,
  Plus,
  Puzzle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { NovaExtension } from '../types';
import { isSafeHttpUrl, normalizeUrl } from '../lib/searchHelpers';

interface ExtensionsModalProps {
  isOpen: boolean;
  extensions: NovaExtension[];
  onClose: () => void;
  onToggleInstall: (id: string, installed: boolean) => void;
  onToggleEnable: (id: string) => void;
  onUpdateSettings: (id: string, settings: NonNullable<NovaExtension['settings']>) => void;
  onAddCustomExtension: (ext: {
    name: string;
    description: string;
    trigger: string;
    targetUrlTemplate: string;
  }) => void;
  onDeleteCustomExtension: (id: string) => void;
}

export const ExtensionsModal: React.FC<ExtensionsModalProps> = ({
  isOpen,
  extensions,
  onClose,
  onToggleInstall,
  onToggleEnable,
  onUpdateSettings,
  onAddCustomExtension,
  onDeleteCustomExtension,
}) => {
  const [hubTab, setHubTab] = useState<'installed' | 'store' | 'create'>('installed');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');

  // Custom extension form state
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customTrigger, setCustomTrigger] = useState('!gh');
  const [customUrl, setCustomUrl] = useState('https://github.com/search?q={q}');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const installedList = extensions.filter((e) => e.installed);
  const activeCount = installedList.filter((e) => e.enabled).length;

  const filteredList = (hubTab === 'installed' ? installedList : extensions).filter((ext) => {
    if (hubTab === 'store' && categoryFilter !== 'الكل' && ext.category !== categoryFilter) {
      return false;
    }
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      ext.name.toLowerCase().includes(q) ||
      ext.description.toLowerCase().includes(q) ||
      ext.category.toLowerCase().includes(q)
    );
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = customName.trim();
    const cleanTrigger = customTrigger.trim().startsWith('!')
      ? customTrigger.trim().toLowerCase()
      : `!${customTrigger.trim().toLowerCase()}`;
    const normalizedUrl = normalizeUrl(customUrl.trim());

    if (!cleanName) {
      setFormError('يرجى إدخال اسم الإضافة.');
      return;
    }
    if (!/^![a-z0-9_-]{1,15}$/.test(cleanTrigger)) {
      setFormError('صيغة الاختصار يجب أن تبدأ بـ ! متبوعة بأحرف إنجليزية أو أرقام (مثال: !gh).');
      return;
    }
    if (!isSafeHttpUrl(normalizedUrl.replace(/\{q\}/g, 'test'))) {
      setFormError('يرجى إدخال رابط موقع صالح يبدأ بـ https:// أو http://.');
      return;
    }
    if (!normalizedUrl.includes('{q}')) {
      setFormError('يجب أن يحتوي رابط البحث على {q} مكان كلمة البحث.');
      return;
    }

    onAddCustomExtension({
      name: cleanName,
      description:
        customDesc.trim() || `بحث مباشر عبر ${cleanTrigger} في ${new URL(normalizedUrl.replace(/\{q\}/g, 'test')).hostname}`,
      trigger: cleanTrigger,
      targetUrlTemplate: normalizedUrl,
    });

    setCustomName('');
    setCustomDesc('');
    setCustomTrigger('!');
    setCustomUrl('');
    setHubTab('installed');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extensions-modal-title"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-[#202124] rounded-3xl border border-[#dadce0] dark:border-[#3c4043] shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaed] dark:border-[#3c4043]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e8f0fe] dark:bg-[#283142] text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center shrink-0">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="extensions-modal-title"
                className="text-lg font-bold text-[#202124] dark:text-[#e8eaed]"
              >
                إضافات متصفح نوفا
              </h2>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] tabular-nums">
                {installedList.length} مثبتة · {activeCount} مفعّلة حالياً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق مدير الإضافات"
            className="p-2 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs & Search Filter */}
        <div className="px-6 py-3 border-b border-[#e8eaed] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex items-center p-1 rounded-full bg-[#e8eaed] dark:bg-[#202124]"
            role="tablist"
            aria-label="أقسام الإضافات"
          >
            <button
              type="button"
              role="tab"
              aria-selected={hubTab === 'installed'}
              onClick={() => setHubTab('installed')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hubTab === 'installed'
                  ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs'
                  : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
              }`}
            >
              المثبتة ({installedList.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={hubTab === 'store'}
              onClick={() => setHubTab('store')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hubTab === 'store'
                  ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs'
                  : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
              }`}
            >
              متجر الإضافات
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={hubTab === 'create'}
              onClick={() => setHubTab('create')}
              className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hubTab === 'create'
                  ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs'
                  : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مخصصة</span>
            </button>
          </div>

          {hubTab !== 'create' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#5f6368] dark:text-[#9aa0a6]" />
              <input
                type="text"
                dir="auto"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث عن إضافة..."
                className="w-full bg-transparent text-xs text-[#202124] dark:text-[#e8eaed] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {hubTab === 'create' ? (
            <form onSubmit={handleCreateSubmit} className="max-w-lg mx-auto space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#202124] dark:text-[#e8eaed] mb-1">
                  إنشاء إضافة اختصار بحث مخصصة
                </h3>
                <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                  أضف أمراً سريعاً يبدأ بعلامة (!) ليفتح أي موقع تفضله مباشرة داخل متصفح نوفا المدمج عند البحث.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">اسم الإضافة</label>
                <input
                  type="text"
                  dir="auto"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="مثال: بحث GitHub السريع"
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#303134] text-sm focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">أمر الاختصار</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={customTrigger}
                    onChange={(e) => setCustomTrigger(e.target.value)}
                    placeholder="!gh"
                    className="w-full px-4 py-2.5 rounded-2xl border border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#303134] text-sm font-mono focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5">
                    قالب رابط البحث (استخدم {'{q}'} للكلمة)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://github.com/search?q={q}"
                    className="w-full px-4 py-2.5 rounded-2xl border border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#303134] text-sm focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">وصف مختصر (اختياري)</label>
                <input
                  type="text"
                  dir="auto"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="مثال: يفتح نتائج المستودعات في GitHub داخل متصفح نوفا"
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#303134] text-sm focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              {formError && (
                <p className="text-xs text-[#d93025] dark:text-[#f28b82] font-medium">
                  {formError}
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHubTab('installed')}
                  className="px-4 py-2 rounded-full text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full text-xs font-medium bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#202124] cursor-pointer"
                >
                  تثبيت الإضافة المخصصة
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {hubTab === 'store' && (
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  {['الكل', 'البحث', 'القراءة', 'الإنتاجية', 'مخصصة'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        categoryFilter === cat
                          ? 'bg-[#e8f0fe] dark:bg-[#283142] text-[#1a73e8] dark:text-[#8ab4f8]'
                          : 'bg-[#f1f3f4] dark:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {filteredList.length === 0 ? (
                <div className="py-12 text-center">
                  <Puzzle className="w-10 h-10 mx-auto text-[#bdc1c6] dark:text-[#5f6368] mb-3" />
                  <p className="text-sm font-medium text-[#202124] dark:text-[#e8eaed]">
                    {hubTab === 'installed'
                      ? 'لا توجد إضافات مثبتة تطابق بحثك.'
                      : 'لم يتم العثور على إضافات مطابقة.'}
                  </p>
                  {hubTab === 'installed' && (
                    <button
                      type="button"
                      onClick={() => setHubTab('store')}
                      className="mt-3 px-4 py-2 rounded-full text-xs font-medium bg-[#1a73e8] text-white cursor-pointer"
                    >
                      تصفح متجر الإضافات
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredList.map((ext) => (
                    <div
                      key={ext.id}
                      className="p-4 rounded-2xl border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: ext.iconColor }}
                          >
                            {ext.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-[#202124] dark:text-[#e8eaed] leading-snug">
                              {ext.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] dark:text-[#9aa0a6] mt-0.5 tabular-nums">
                              <span>{ext.category}</span>
                              <span aria-hidden="true">·</span>
                              <span>الإصدار {ext.version}</span>
                              <span aria-hidden="true">·</span>
                              <span>{ext.author}</span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed">
                          {ext.description}
                        </p>

                        {ext.customRule && (
                          <p dir="ltr" className="mt-2 text-[11px] font-mono text-[#1a73e8] dark:text-[#8ab4f8] truncate text-right">
                            {ext.customRule.trigger} → {ext.customRule.targetUrlTemplate}
                          </p>
                        )}

                        {/* Eye Comfort Settings when installed & enabled */}
                        {ext.id === 'eye_comfort_reader' && ext.installed && ext.enabled && (
                          <div className="mt-3 pt-3 border-t border-[#f1f3f4] dark:border-[#3c4043] flex flex-wrap items-center gap-3 text-xs">
                            <label className="flex items-center gap-1.5">
                              <span className="text-[#5f6368] dark:text-[#9aa0a6]">النمط:</span>
                              <select
                                value={ext.settings?.readerTheme || 'sepia'}
                                onChange={(e) =>
                                  onUpdateSettings(ext.id, {
                                    ...ext.settings,
                                    readerTheme: e.target.value as 'auto' | 'sepia' | 'night',
                                  })
                                }
                                className="px-2 py-1 rounded-lg border border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#303134] text-xs"
                              >
                                <option value="sepia">ورقي دافئ</option>
                                <option value="night">ليلي مريح</option>
                                <option value="auto">تلقائي</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-1.5">
                              <span className="text-[#5f6368] dark:text-[#9aa0a6]">الخط:</span>
                              <select
                                value={ext.settings?.readerFontSize || 'large'}
                                onChange={(e) =>
                                  onUpdateSettings(ext.id, {
                                    ...ext.settings,
                                    readerFontSize: e.target.value as 'normal' | 'large' | 'xlarge',
                                  })
                                }
                                className="px-2 py-1 rounded-lg border border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#303134] text-xs"
                              >
                                <option value="normal">عادي</option>
                                <option value="large">كبير</option>
                                <option value="xlarge">مكبر</option>
                              </select>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="pt-3 border-t border-[#f1f3f4] dark:border-[#3c4043] flex items-center justify-between gap-2">
                        {ext.installed ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onToggleEnable(ext.id)}
                              aria-pressed={ext.enabled}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                ext.enabled
                                  ? 'bg-[#e6f4ea] dark:bg-[#1e3524] text-[#137333] dark:text-[#81c995]'
                                  : 'bg-[#f1f3f4] dark:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6]'
                              }`}
                            >
                              {ext.enabled && <Check className="w-3.5 h-3.5" />}
                              <span>{ext.enabled ? 'مفعّلة' : 'معطّلة'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                ext.isCustom
                                  ? onDeleteCustomExtension(ext.id)
                                  : onToggleInstall(ext.id, false)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#d93025] dark:text-[#f28b82] hover:bg-[#fce8e6] dark:hover:bg-[#3c1e1e] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>إزالة</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleInstall(ext.id, true)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#202124] transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>تثبيت الإضافة</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
