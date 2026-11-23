import React, { useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Newspaper,
  Puzzle,
  Search,
  Sparkles,
  Star,
  Video,
  X,
} from 'lucide-react';
import {
  BookmarkEntry,
  DriveFileItem,
  EngineMode,
  GroundingSummary,
  KnowledgeGraphData,
  NovaAccount,
  SearchHistoryEntry,
  SearchResultItem,
  SearchTab,
  ThemeMode,
} from '../types';
import { getExternalSearchUrl, isSafeHttpUrl } from '../lib/searchHelpers';
import { NovaLogo } from './NovaLogo';
import { SearchBar } from './SearchBar';
import { CalculatorCard } from './CalculatorCard';
import { TtsButton } from './TtsButton';

interface SerpViewProps {
  query: string;
  inputValue: string;
  onInputChange: (val: string) => void;
  onSubmitSearch: (q: string) => void;
  onGoHome: () => void;
  activeTab: SearchTab;
  onChangeTab: (tab: SearchTab) => void;
  engineMode: EngineMode;
  onChangeEngine: (mode: EngineMode) => void;
  onOpenApiModal: () => void;
  onOpenBookmarks: () => void;
  onOpenExtensions: () => void;
  activeExtensionsCount: number;
  account: NovaAccount;
  theme: ThemeMode;
  onToggleTheme: () => void;
  history: SearchHistoryEntry[];
  isLoading: boolean;
  errorMsg: string | null;
  googleResults: SearchResultItem[];
  instantResults: SearchResultItem[];
  imageResults: SearchResultItem[];
  currentPage: number;
  onPageChange: (page: number) => void;
  knowledgeGraph: KnowledgeGraphData | null;
  groundingSummary: GroundingSummary | null;
  isGroundingLoading: boolean;
  groundingError: string | null;
  onRetryGrounding: () => void;
  mathResult: { expression: string; result: string } | null;
  bookmarks: BookmarkEntry[];
  onToggleBookmark: (item: SearchResultItem) => void;
  onOpenUrl: (url: string, title?: string) => void;
  // Drive integration
  driveFiles: DriveFileItem[];
  isDriveLoading: boolean;
  driveError: string | null;
  hasDriveToken: boolean;
  onConnectDrive: () => Promise<void>;
  onSaveSummaryToDrive: (summaryText: string) => Promise<void>;
  // Account Menu button
  renderAccountControl: () => React.ReactNode;
}

const TABS: { id: SearchTab; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'الكل', icon: <Search className="w-4 h-4" /> },
  { id: 'images', label: 'الصور', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'videos', label: 'الفيديو', icon: <Video className="w-4 h-4" /> },
  { id: 'news', label: 'الأخبار', icon: <Newspaper className="w-4 h-4" /> },
  { id: 'drive', label: 'ملفات Drive', icon: <HardDrive className="w-4 h-4" /> },
];

export const SerpView: React.FC<SerpViewProps> = ({
  query,
  inputValue,
  onInputChange,
  onSubmitSearch,
  onGoHome,
  activeTab,
  onChangeTab,
  engineMode,
  onChangeEngine,
  onOpenApiModal,
  onOpenBookmarks,
  onOpenExtensions,
  activeExtensionsCount,
  history,
  isLoading,
  errorMsg,
  googleResults,
  instantResults,
  imageResults,
  currentPage,
  onPageChange,
  knowledgeGraph,
  groundingSummary,
  isGroundingLoading,
  groundingError,
  onRetryGrounding,
  mathResult,
  bookmarks,
  onToggleBookmark,
  onOpenUrl,
  driveFiles,
  isDriveLoading,
  driveError,
  hasDriveToken,
  onConnectDrive,
  onSaveSummaryToDrive,
  renderAccountControl,
}) => {
  const [lightboxItem, setLightboxItem] = useState<SearchResultItem | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [showDriveSaveConfirm, setShowDriveSaveConfirm] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveSaveNotice, setDriveSaveNotice] = useState<string | null>(null);

  const isBookmarked = (url: string) => bookmarks.some((b) => b.url === url);

  const combinedResults: SearchResultItem[] = (() => {
    const dedup = (items: SearchResultItem[]) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
    };

    if (engineMode === 'google') {
      const googleOnly = dedup([
        ...googleResults,
        ...instantResults.filter((r) => r.source === 'google'),
      ]);
      return googleOnly.length > 0 ? googleOnly : dedup(instantResults);
    }
    if (engineMode === 'duckduckgo') {
      const ddgOnly = dedup(instantResults.filter((r) => r.source !== 'google'));
      return ddgOnly.length > 0 ? ddgOnly : dedup(instantResults);
    }
    return dedup([...googleResults, ...instantResults]);
  })();

  const totalPages = Math.max(1, Math.ceil(combinedResults.length / 10));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedResults = combinedResults.slice((safePage - 1) * 10, safePage * 10);

  const handleConfirmSaveToDrive = async () => {
    if (!groundingSummary?.summary) return;
    setIsSavingToDrive(true);
    setDriveSaveNotice(null);
    try {
      await onSaveSummaryToDrive(groundingSummary.summary);
      setDriveSaveNotice('تم حفظ ملخص البحث في Google Drive بنجاح.');
      setShowDriveSaveConfirm(false);
    } catch (err: unknown) {
      setDriveSaveNotice(err instanceof Error ? err.message : 'تعذر حفظ الملف في Google Drive.');
    } finally {
      setIsSavingToDrive(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] flex flex-col">
      {/* Top Sticky Search Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-[#202124] border-b border-[#ebebeb] dark:border-[#3c4043]">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 pt-3.5 pb-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 sm:gap-5">
          {/* Right Zone (Start in RTL): Logo + SearchBar */}
          <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-[260px]">
            <NovaLogo size="sm" onClick={onGoHome} showArabicSubtitle={true} />
            <div className="flex-1 max-w-2xl">
              <SearchBar
                value={inputValue}
                onChange={onInputChange}
                onSubmit={onSubmitSearch}
                history={history}
                compact
              />
            </div>
          </div>

          {/* Left Zone (End in RTL): Engine Switcher + API Config + Account */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="hidden md:flex items-center p-0.5 rounded-full bg-[#f1f3f4] dark:bg-[#303134] border border-[#e0e2e7] dark:border-[#3c4043]"
              role="group"
              aria-label="تبديل محرك البحث"
            >
              {(
                [
                  { id: 'hybrid', label: 'مدمج' },
                  { id: 'google', label: 'Google' },
                  { id: 'duckduckgo', label: 'DuckDuckGo' },
                ] as { id: EngineMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeEngine(m.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    engineMode === m.id
                      ? 'bg-white dark:bg-[#202124] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs'
                      : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenBookmarks}
              title="المفضلة"
              aria-label="المفضلة"
              className="p-2 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
            >
              <Bookmark className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenExtensions}
              title="إضافات المتصفح"
              aria-label="إضافات المتصفح"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Puzzle className="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#8ab4f8]" />
              <span className="hidden sm:inline">الإضافات</span>
              <span className="font-mono tabular-nums text-[#5f6368] dark:text-[#9aa0a6]">
                ({activeExtensionsCount})
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenApiModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#5f6368] dark:text-[#9aa0a6]" />
              <span className="hidden sm:inline">إعدادات المحرك</span>
            </button>

            {renderAccountControl()}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:pr-[164px] flex items-center gap-6 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTab(t.id)}
                className={`inline-flex items-center gap-1.5 py-2.5 text-xs sm:text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-[#1a73e8] dark:border-[#8ab4f8] text-[#1a73e8] dark:text-[#8ab4f8]'
                    : 'border-transparent text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main SERP Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 lg:pr-[164px] py-5">
        {/* Dual Engine External Launch Actions + Search Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b border-[#f1f3f4] dark:border-[#3c4043]">
          <div className="text-xs text-[#70757a] dark:text-[#9aa0a6]">
            {activeTab === 'drive' ? (
              <span>نتائج البحث في Google Drive عن «{query}»</span>
            ) : activeTab === 'images' ? (
              <span className="tabular-nums">
                عرض {imageResults.length} صورة مطابقة لـ «{query}»
              </span>
            ) : (
              <span className="tabular-nums">
                عرض {combinedResults.length} نتيجة فورية لـ «{query}» عبر محرك نوفا
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={getExternalSearchUrl('google', query, activeTab)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onOpenUrl(getExternalSearchUrl('google', query, activeTab), `Google: ${query}`);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f6fe] dark:hover:bg-[#283142] transition-colors whitespace-nowrap shrink-0"
            >
              <span>عرض النتائج الكاملة في Google</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={getExternalSearchUrl('duckduckgo', query, activeTab)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onOpenUrl(
                    getExternalSearchUrl('duckduckgo', query, activeTab),
                    `DuckDuckGo: ${query}`
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] text-[#de5833] dark:text-[#f28b82] hover:bg-[#fef3f0] dark:hover:bg-[#3c241e] transition-colors whitespace-nowrap shrink-0"
            >
              <span>عرض النتائج الكاملة في DuckDuckGo</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Google Drive Tab View */}
        {activeTab === 'drive' ? (
          <div className="max-w-3xl">
            {!hasDriveToken ? (
              <div className="rounded-3xl border border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] p-8 text-center">
                <HardDrive className="w-10 h-10 mx-auto text-[#4285F4] mb-3" />
                <h2 className="text-lg font-bold text-[#202124] dark:text-[#e8eaed] mb-2">
                  ربط Google Drive للبحث في ملفاتك
                </h2>
                <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mb-6 max-w-md mx-auto leading-relaxed">
                  سجّل الدخول بحساب Google لمنح محرك نوفا إذن البحث في ملفاتك ومستنداتك داخل Google Drive وعرضها هنا بأمان.
                </p>
                <button
                  type="button"
                  onClick={onConnectDrive}
                  className="gsi-material-button mx-auto"
                >
                  <div className="gsi-material-button-state" />
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                        <path fill="none" d="M0 0h48v48H0z" />
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">Sign in with Google</span>
                  </div>
                </button>
              </div>
            ) : isDriveLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-20 rounded-2xl bg-[#f1f3f4] dark:bg-[#303134] animate-pulse"
                  />
                ))}
              </div>
            ) : driveError ? (
              <div className="p-5 rounded-2xl bg-[#fce8e6] dark:bg-[#3c1e1e] text-[#c5221f] dark:text-[#f28b82] text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{driveError}</span>
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-8 rounded-2xl border border-[#e8eaed] dark:border-[#3c4043] text-center">
                <FolderOpen className="w-9 h-9 mx-auto text-[#9aa0a6] mb-2" />
                <p className="text-sm font-medium">
                  لم يتم العثور على ملفات في Google Drive تطابق «{query}».
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-[#e8eaed] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#28292c] transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#e8f0fe] dark:bg-[#283142] text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        {file.webViewLink && isSafeHttpUrl(file.webViewLink) ? (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              const link = file.webViewLink!;
                              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                e.preventDefault();
                                onOpenUrl(link, file.name);
                              }
                            }}
                            className="text-sm font-semibold text-[#1a0dab] dark:text-[#8ab4f8] hover:underline block truncate"
                          >
                            {file.name}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold truncate">{file.name}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
                          <span>{file.mimeType.split('.').pop()}</span>
                          {file.modifiedTime && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                آخر تعديل:{' '}
                                {new Date(file.modifiedTime).toLocaleDateString('ar-EG')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {file.webViewLink && isSafeHttpUrl(file.webViewLink) && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          const link = file.webViewLink!;
                          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            onOpenUrl(link, file.name);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] hover:bg-white dark:hover:bg-[#303134] shrink-0"
                      >
                        <span>فتح</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Standard SERP 2-column grid (Results + Knowledge Graph) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Primary Results Column */}
            <div className="lg:col-span-8 min-w-0">
              {/* Smart Calculator Answer Box */}
              {mathResult && (
                <CalculatorCard
                  initialExpression={mathResult.expression}
                  initialResult={mathResult.result}
                />
              )}

              {/* Gemini Search Grounding Summary Card (All / News tabs) */}
              {(activeTab === 'all' || activeTab === 'news') && (
                <section
                  aria-label="ملخص نوفا الذكي"
                  className="mb-7 rounded-2xl border border-[#d2e3fc] dark:border-[#394457] bg-[#f8fbff] dark:bg-[#242830] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#1a73e8] dark:text-[#8ab4f8]" />
                      <h2 className="text-sm font-bold text-[#1a73e8] dark:text-[#8ab4f8]">
                        ملخص نوفا الذكي
                      </h2>
                      <span aria-hidden="true" className="text-[#9aa0a6]">
                        ·
                      </span>
                      <span className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                        مدعوم بالبحث المباشر في الويب
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {groundingSummary?.summary && (
                        <>
                          <TtsButton
                            text={groundingSummary.summary}
                            label="استماع للملخص"
                          />
                          {hasDriveToken && (
                            <button
                              type="button"
                              onClick={() => setShowDriveSaveConfirm(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#28292c] text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <HardDrive className="w-3.5 h-3.5 text-[#34A853]" />
                              <span>حفظ في Drive</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {driveSaveNotice && (
                    <p className="mb-3 text-xs text-[#137333] dark:text-[#81c995] font-medium">
                      {driveSaveNotice}
                    </p>
                  )}

                  {isGroundingLoading ? (
                    <div className="space-y-2.5 py-1">
                      <div className="h-3.5 w-11/12 rounded bg-[#e8f0fe] dark:bg-[#303642] animate-pulse" />
                      <div className="h-3.5 w-9/12 rounded bg-[#e8f0fe] dark:bg-[#303642] animate-pulse" />
                      <div className="h-3.5 w-7/12 rounded bg-[#e8f0fe] dark:bg-[#303642] animate-pulse" />
                    </div>
                  ) : groundingError ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                        {groundingError}
                      </p>
                      <button
                        type="button"
                        onClick={onRetryGrounding}
                        className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-white dark:hover:bg-[#303134] transition-colors cursor-pointer shrink-0"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : groundingSummary?.summary ? (
                    <div>
                      <div
                        dir="auto"
                        className="text-sm text-[#202124] dark:text-[#e8eaed] leading-relaxed whitespace-pre-line"
                      >
                        {groundingSummary.summary}
                      </div>

                      {groundingSummary.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#e0e8f5] dark:border-[#394457]">
                          <p className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-2">
                            المصادر المرجعية:
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {groundingSummary.sources.slice(0, 5).map((src, i) =>
                              isSafeHttpUrl(src.uri) ? (
                                <a
                                  key={i}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                      e.preventDefault();
                                      onOpenUrl(src.uri, src.title);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-xs text-[#1a73e8] dark:text-[#8ab4f8] hover:underline max-w-[260px]"
                                >
                                  <Globe className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{src.title}</span>
                                </a>
                              ) : null
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              )}

              {/* Error Message */}
              {errorMsg && (
                <div className="mb-6 p-4 rounded-2xl bg-[#fce8e6] dark:bg-[#3c1e1e] text-[#c5221f] dark:text-[#f28b82] text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{errorMsg}</p>
                    <button
                      type="button"
                      onClick={onOpenApiModal}
                      className="mt-2 text-xs underline cursor-pointer"
                    >
                      فحص إعدادات المحرك
                    </button>
                  </div>
                </div>
              )}

              {/* Loading Skeletons */}
              {isLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="space-y-2">
                      <div className="h-3 w-48 rounded bg-[#f1f3f4] dark:bg-[#303134] animate-pulse" />
                      <div className="h-5 w-3/4 rounded bg-[#e8eaed] dark:bg-[#3c4043] animate-pulse" />
                      <div className="h-3.5 w-full rounded bg-[#f1f3f4] dark:bg-[#303134] animate-pulse" />
                      <div className="h-3.5 w-5/6 rounded bg-[#f1f3f4] dark:bg-[#303134] animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : activeTab === 'images' ? (
                /* Image Search Grid */
                imageResults.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-[#e8eaed] dark:border-[#3c4043] text-center">
                    <ImageIcon className="w-10 h-10 mx-auto text-[#9aa0a6] mb-3" />
                    <p className="text-sm font-medium mb-2">
                      لم يتم العثور على صور مطابقة لـ «{query}».
                    </p>
                    <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                      جرّب تعديل كلمات البحث أو استخدام أزرار الفتح المباشر في Google أو DuckDuckGo أعلاه.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {imageResults.map((item) => {
                      const imgSrc = item.image?.thumbnailLink || item.url;
                      const isBroken = failedImages[item.id];
                      return (
                        <div key={item.id} className="group flex flex-col">
                          <button
                            type="button"
                            onClick={() => setLightboxItem(item)}
                            className="relative aspect-4/3 rounded-2xl overflow-hidden bg-[#f1f3f4] dark:bg-[#303134] border border-[#e8eaed] dark:border-[#3c4043] cursor-pointer"
                          >
                            {!isBroken && isSafeHttpUrl(imgSrc) ? (
                              <img
                                src={imgSrc}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                                }
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-3 text-[#9aa0a6]">
                                <ImageIcon className="w-7 h-7 mb-1" />
                                <span className="text-[11px] line-clamp-1">{item.displayLink}</span>
                              </div>
                            )}
                          </button>
                          <a
                            href={isSafeHttpUrl(item.image?.contextLink || item.url) ? item.image?.contextLink || item.url : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              const target = item.image?.contextLink || item.url;
                              if (isSafeHttpUrl(target) && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                e.preventDefault();
                                onOpenUrl(target, item.title);
                              }
                            }}
                            className="mt-1.5 text-xs font-medium text-[#202124] dark:text-[#e8eaed] hover:underline truncate"
                          >
                            {item.title}
                          </a>
                          <span dir="ltr" className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] truncate text-right">
                            {item.displayLink}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : combinedResults.length === 0 ? (
                <div className="p-8 rounded-2xl border border-[#e8eaed] dark:border-[#3c4043] text-center">
                  <Search className="w-10 h-10 mx-auto text-[#9aa0a6] mb-3" />
                  <p className="text-sm font-medium text-[#202124] dark:text-[#e8eaed]">
                    لم يتم العثور على نتائج مباشرة مطابقة لـ «{query}».
                  </p>
                  <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1.5">
                    جرّب استخدام أزرار الفتح المباشر في Google أو DuckDuckGo أعلاه أو تعديل كلمات البحث.
                  </p>
                </div>
              ) : (
                /* Classic Google SERP List */
                <div className="space-y-7">
                  {paginatedResults.map((item) => {
                    const bookmarked = isBookmarked(item.url);
                    const safeUrl = isSafeHttpUrl(item.url) ? item.url : '#';
                    return (
                      <article key={item.id} className="group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {/* Site Favicon & Breadcrumb */}
                            <div className="flex items-center gap-2.5 mb-1">
                              <div className="w-6 h-6 rounded-full bg-[#f1f3f4] dark:bg-[#303134] border border-[#e8eaed] dark:border-[#3c4043] flex items-center justify-center overflow-hidden shrink-0">
                                {item.favicon && !failedImages[`fav_${item.id}`] ? (
                                  <img
                                    src={item.favicon}
                                    alt={item.displayLink}
                                    referrerPolicy="no-referrer"
                                    onError={() =>
                                      setFailedImages((prev) => ({
                                        ...prev,
                                        [`fav_${item.id}`]: true,
                                      }))
                                    }
                                    className="w-4 h-4 object-contain"
                                  />
                                ) : (
                                  <Globe className="w-3.5 h-3.5 text-[#5f6368] dark:text-[#9aa0a6]" />
                                )}
                              </div>
                              <div className="min-w-0 flex items-center gap-2 text-xs text-[#4d5156] dark:text-[#bdc1c6]">
                                <span dir="ltr" className="truncate font-medium">
                                  {item.displayLink}
                                </span>
                                <span aria-hidden="true" className="text-[#9aa0a6]">
                                  ·
                                </span>
                                <span className="text-[#70757a] dark:text-[#9aa0a6] whitespace-nowrap">
                                  {item.source === 'google'
                                    ? 'Google'
                                    : item.source === 'wiki'
                                      ? 'ويكيبيديا'
                                      : 'DuckDuckGo'}
                                </span>
                              </div>
                            </div>

                            {/* Result Title */}
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                if (safeUrl !== '#' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                  e.preventDefault();
                                  onOpenUrl(safeUrl, item.title);
                                }
                              }}
                              className="block text-lg sm:text-[19px] font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline leading-snug"
                            >
                              <span dir="auto">{item.title}</span>
                            </a>

                            {/* 2-line Snippet */}
                            <p
                              dir="auto"
                              className="mt-1 text-sm text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed line-clamp-2"
                            >
                              {item.snippet}
                            </p>
                          </div>

                          {/* Bookmark Star Action */}
                          <button
                            type="button"
                            onClick={() => onToggleBookmark(item)}
                            title={bookmarked ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
                            aria-label={bookmarked ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
                            className={`p-2 rounded-full transition-colors cursor-pointer shrink-0 ${
                              bookmarked
                                ? 'text-[#fbbc04] bg-[#fef7e0] dark:bg-[#332b14]'
                                : 'text-[#9aa0a6] hover:text-[#fbbc04] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`}
                            />
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {/* Google-style Pagination */}
                  {totalPages > 1 && (
                    <nav
                      aria-label="ترقيم صفحات النتائج"
                      className="pt-6 pb-4 flex items-center justify-center gap-2 border-t border-[#f1f3f4] dark:border-[#3c4043]"
                    >
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => onPageChange(safePage - 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f6fe] dark:hover:bg-[#283142] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                        <span>السابق</span>
                      </button>

                      {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onPageChange(p)}
                          className={`w-8 h-8 rounded-full text-xs font-mono tabular-nums font-medium transition-colors cursor-pointer ${
                            safePage === p
                              ? 'bg-[#1a73e8] dark:bg-[#8ab4f8] text-white dark:text-[#202124]'
                              : 'text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f6fe] dark:hover:bg-[#283142]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => onPageChange(safePage + 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f6fe] dark:hover:bg-[#283142] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        <span>التالي</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </nav>
                  )}
                </div>
              )}
            </div>

            {/* Side Panel: Knowledge Graph (بطاقة المعلومات السريعة) */}
            {knowledgeGraph && activeTab !== 'images' && (
              <aside className="lg:col-span-4 w-full">
                <div className="rounded-2xl border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#202124] overflow-hidden">
                  {knowledgeGraph.imageUrl &&
                    !failedImages['kg_img'] &&
                    isSafeHttpUrl(knowledgeGraph.imageUrl) && (
                      <div className="h-44 w-full bg-[#f8f9fa] dark:bg-[#303134] overflow-hidden border-b border-[#e8eaed] dark:border-[#3c4043]">
                        <img
                          src={knowledgeGraph.imageUrl}
                          alt={knowledgeGraph.title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, kg_img: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-[#202124] dark:text-[#e8eaed]">
                          {knowledgeGraph.title}
                        </h3>
                        {knowledgeGraph.description && (
                          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
                            {knowledgeGraph.description}
                          </p>
                        )}
                      </div>
                      {knowledgeGraph.abstractSource && (
                        <span className="text-xs text-[#5f6368] dark:text-[#9aa0a6] shrink-0">
                          {knowledgeGraph.abstractSource}
                        </span>
                      )}
                    </div>

                    <p
                      dir="auto"
                      className="text-sm text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed mt-3"
                    >
                      {knowledgeGraph.abstractText}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <TtsButton
                        text={knowledgeGraph.abstractText}
                        label="استماع للمعلومات"
                      />

                      {knowledgeGraph.abstractUrl &&
                        isSafeHttpUrl(knowledgeGraph.abstractUrl) && (
                          <a
                            href={knowledgeGraph.abstractUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              const target = knowledgeGraph.abstractUrl!;
                              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                e.preventDefault();
                                onOpenUrl(target, knowledgeGraph.title);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:underline"
                          >
                            <span>المزيد من المصدر</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                    </div>

                    {knowledgeGraph.infobox && knowledgeGraph.infobox.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#e8eaed] dark:border-[#3c4043] space-y-2">
                        {knowledgeGraph.infobox.map((row, idx) => (
                          <div key={idx} className="text-xs flex justify-between gap-3">
                            <span className="font-semibold text-[#202124] dark:text-[#e8eaed]">
                              {row.label}
                            </span>
                            <span className="text-[#5f6368] dark:text-[#9aa0a6] text-left">
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {knowledgeGraph.relatedTopics.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#e8eaed] dark:border-[#3c4043]">
                        <h4 className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-2">
                          موضوعات ذات صلة
                        </h4>
                        <ul className="space-y-1.5">
                          {knowledgeGraph.relatedTopics.map((topic, idx) =>
                            isSafeHttpUrl(topic.url) ? (
                              <li key={idx}>
                                <a
                                  href={topic.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                      e.preventDefault();
                                      onOpenUrl(topic.url, topic.text);
                                    }
                                  }}
                                  className="text-xs text-[#1a73e8] dark:text-[#8ab4f8] hover:underline line-clamp-1"
                                >
                                  {topic.text}
                                </a>
                              </li>
                            ) : null
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </main>

      {/* Image Lightbox Modal */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="max-w-3xl w-full bg-white dark:bg-[#202124] rounded-3xl overflow-hidden border border-[#3c4043] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e8eaed] dark:border-[#3c4043]">
              <h3 className="text-sm font-bold truncate">{lightboxItem.title}</h3>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                aria-label="إغلاق المعاينة"
                className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#f8f9fa] dark:bg-[#121316] flex items-center justify-center max-h-[65vh] p-4">
              <img
                src={lightboxItem.url}
                alt={lightboxItem.title}
                referrerPolicy="no-referrer"
                className="max-h-[58vh] object-contain rounded-lg"
              />
            </div>
            <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[#5f6368] dark:text-[#9aa0a6]">
                <span>{lightboxItem.displayLink}</span>
                {lightboxItem.image?.width && lightboxItem.image?.height && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {lightboxItem.image.width} × {lightboxItem.image.height}
                    </span>
                  </>
                )}
              </div>
              {isSafeHttpUrl(lightboxItem.image?.contextLink || lightboxItem.url) && (
                <a
                  href={lightboxItem.image?.contextLink || lightboxItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    const target = lightboxItem.image?.contextLink || lightboxItem.url;
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      setLightboxItem(null);
                      onOpenUrl(target, lightboxItem.title);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1a73e8] text-white font-medium hover:bg-[#1557b0]"
                >
                  <span>زيارة المصدر</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Dialog for saving summary to Google Drive */}
      {showDriveSaveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد الحفظ في Google Drive"
        >
          <div className="max-w-md w-full bg-white dark:bg-[#202124] rounded-3xl p-6 border border-[#dadce0] dark:border-[#3c4043] shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#e6f4ea] dark:bg-[#1e3524] text-[#34A853] flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">حفظ ملخص البحث في Google Drive</h3>
            </div>
            <p className="text-sm text-[#5f6368] dark:text-[#bdc1c6] leading-relaxed mb-5">
              هل ترغب في إنشاء ملف نصي جديد باسم{' '}
              <strong className="text-[#202124] dark:text-[#e8eaed]">
                «ملخص نوفا - {query}.txt»
              </strong>{' '}
              داخل حسابك في Google Drive؟
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDriveSaveConfirm(false)}
                className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSavingToDrive}
                onClick={handleConfirmSaveToDrive}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-60 cursor-pointer"
              >
                {isSavingToDrive && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>تأكيد الحفظ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
