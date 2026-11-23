import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  Lock,
  Monitor,
  Puzzle,
  RotateCw,
  Star,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { ExtensionNoteEntry, NovaExtension, SearchResultItem } from '../types';
import { filterClutterBlock, isExtensionActive } from '../lib/extensionsCatalog';
import { getFaviconUrl, isSafeHttpUrl, normalizeUrl } from '../lib/searchHelpers';
import { TtsButton } from './TtsButton';

interface InAppBrowserProps {
  url: string | null;
  initialTitle?: string;
  isBookmarked: (url: string) => boolean;
  onToggleBookmark: (item: SearchResultItem) => void;
  extensions: NovaExtension[];
  onOpenExtensions: () => void;
  notes: ExtensionNoteEntry[];
  onAddNote: (url: string, pageTitle: string, content: string) => void;
  onDeleteNote: (noteId: string) => void;
  onClose: () => void;
}

interface PreviewBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li';
  text: string;
}

interface PreviewLink {
  text: string;
  url: string;
}

interface PreviewData {
  url: string;
  title: string;
  siteName: string;
  description: string;
  heroImage?: string;
  embedBlocked: boolean;
  contentType: string;
  blocks: PreviewBlock[];
  links: PreviewLink[];
}

function getIframeTarget(rawUrl: string): { src: string; isDirectEmbed: boolean } {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtube.com') && parsed.pathname === '/watch') {
      const vid = parsed.searchParams.get('v');
      if (vid && /^[a-zA-Z0-9_-]{6,20}$/.test(vid)) {
        return { src: `https://www.youtube.com/embed/${vid}`, isDirectEmbed: true };
      }
    }
    if (host === 'youtu.be') {
      const vid = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (vid && /^[a-zA-Z0-9_-]{6,20}$/.test(vid)) {
        return { src: `https://www.youtube.com/embed/${vid}`, isDirectEmbed: true };
      }
    }
    if (host === 'drive.google.com') {
      const fileMatch = parsed.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        return {
          src: `https://drive.google.com/file/d/${fileMatch[1]}/preview`,
          isDirectEmbed: true,
        };
      }
    }
    if (host === 'docs.google.com') {
      const docMatch = parsed.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
      if (docMatch) {
        return {
          src: `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`,
          isDirectEmbed: true,
        };
      }
    }
  } catch {
    // fallback
  }
  return { src: rawUrl, isDirectEmbed: false };
}

export const InAppBrowser: React.FC<InAppBrowserProps> = ({
  url,
  initialTitle,
  isBookmarked,
  onToggleBookmark,
  extensions,
  onOpenExtensions,
  notes,
  onAddNote,
  onDeleteNote,
  onClose,
}) => {
  const [historyStack, setHistoryStack] = useState<{ url: string; title?: string }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [addressInput, setAddressInput] = useState('');
  const [viewMode, setViewMode] = useState<'iframe' | 'reader'>('iframe');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentEntry = historyIndex >= 0 ? historyStack[historyIndex] : null;
  const currentUrl = currentEntry?.url || null;

  // Initialize when parent opens a new URL
  useEffect(() => {
    if (!url || !isSafeHttpUrl(url)) {
      setHistoryStack([]);
      setHistoryIndex(-1);
      return;
    }
    setHistoryStack([{ url, title: initialTitle }]);
    setHistoryIndex(0);
    setAddressInput(url);
    setViewMode('iframe');
    setIframeLoading(true);
    setHeroFailed(false);
  }, [url, initialTitle]);

  const navigateTo = useCallback(
    (nextRawUrl: string, nextTitle?: string) => {
      const normalized = normalizeUrl(nextRawUrl);
      if (!isSafeHttpUrl(normalized)) return;

      setHistoryStack((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, { url: normalized, title: nextTitle }];
      });
      setHistoryIndex((idx) => idx + 1);
      setAddressInput(normalized);
      setViewMode('iframe');
      setIframeLoading(true);
      setHeroFailed(false);
    },
    [historyIndex]
  );

  // Listen for safe link/form navigation messages from our sandboxed proxied iframe
  useEffect(() => {
    if (!currentUrl) return;
    const handleFrameMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const payload = event.data as { type?: unknown; url?: unknown; title?: unknown } | null;
      if (!payload || payload.type !== 'nova-browser-navigate') return;
      if (typeof payload.url !== 'string' || !isSafeHttpUrl(payload.url)) return;
      navigateTo(payload.url, typeof payload.title === 'string' ? payload.title : undefined);
    };
    window.addEventListener('message', handleFrameMessage);
    return () => window.removeEventListener('message', handleFrameMessage);
  }, [currentUrl, navigateTo]);

  // Fetch safe metadata & check embed headers whenever currentUrl or reloadNonce changes
  useEffect(() => {
    if (!currentUrl) return;
    let cancelled = false;
    setAddressInput(currentUrl);
    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setHeroFailed(false);
    setIframeLoading(true);

    fetch(`/api/browser/preview?url=${encodeURIComponent(currentUrl)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'تعذر تحميل الصفحة.');
        return data as PreviewData;
      })
      .then((data) => {
        if (cancelled) return;
        setPreviewData(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : 'تعذر جلب معاينة الموقع.');
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUrl, reloadNonce]);

  // Escape key closes browser
  useEffect(() => {
    if (!currentUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentUrl, onClose]);

  if (!url || !currentUrl) return null;

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;
  const iframeTarget = getIframeTarget(currentUrl);
  const displayTitle = previewData?.title || currentEntry?.title || currentUrl;
  let displayHost = currentUrl;
  try {
    displayHost = new URL(currentUrl).hostname;
  } catch {
    // keep raw
  }
  const bookmarked = isBookmarked(currentUrl);

  const shouldUseProxy =
    !iframeTarget.isDirectEmbed && !isPreviewLoading && (previewData?.embedBlocked ?? true);
  const resolvedSiteUrl = previewData?.url || currentUrl;
  const activeFrameSrc = iframeTarget.isDirectEmbed
    ? iframeTarget.src
    : isPreviewLoading
      ? null
      : shouldUseProxy
        ? `/api/browser/render?url=${encodeURIComponent(resolvedSiteUrl)}&_r=${reloadNonce}`
        : resolvedSiteUrl;

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;
    navigateTo(addressInput.trim());
  };

  const handleBookmarkClick = () => {
    onToggleBookmark({
      id: `bm_${Date.now()}`,
      title: displayTitle,
      url: currentUrl,
      displayLink: displayHost,
      snippet: previewData?.description || '',
      favicon: getFaviconUrl(currentUrl),
      source: 'google',
    });
  };

  const hasTranslator = isExtensionActive(extensions, 'instant_translator');
  const hasNotesExt = isExtensionActive(extensions, 'page_notes');
  const hasClutterBlocker = isExtensionActive(extensions, 'ad_clutter_blocker');
  const eyeComfortExt = extensions.find(
    (e) => e.id === 'eye_comfort_reader' && e.installed && e.enabled
  );
  const activeExtCount = extensions.filter((e) => e.installed && e.enabled).length;

  const readerTheme = eyeComfortExt?.settings?.readerTheme || 'auto';
  const readerFontSize = eyeComfortExt?.settings?.readerFontSize || 'normal';

  const readerContainerClass =
    readerTheme === 'sepia'
      ? 'bg-[#f6efe2] text-[#2c2218]'
      : readerTheme === 'night'
        ? 'bg-[#121418] text-[#e1e4ea]'
        : 'bg-white dark:bg-[#171717] text-[#202124] dark:text-[#e8eaed]';

  const readerFontClass =
    readerFontSize === 'xlarge'
      ? 'text-base sm:text-lg leading-loose'
      : readerFontSize === 'large'
        ? 'text-base leading-relaxed'
        : 'text-sm sm:text-base leading-relaxed';

  const visibleBlocks = previewData
    ? hasClutterBlocker
      ? previewData.blocks.filter((b) => !filterClutterBlock(b.text))
      : previewData.blocks
    : [];

  const readerArticleText = previewData
    ? [previewData.title, previewData.description, ...visibleBlocks.slice(0, 12).map((b) => b.text)]
        .filter(Boolean)
        .join('. ')
    : '';

  const pageNotes = notes.filter((n) => n.url === currentUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed]"
      role="dialog"
      aria-modal="true"
      aria-label="متصفح نوفا المدمج"
    >
      {/* Top Browser Chrome */}
      <header className="shrink-0 border-b border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] px-3 sm:px-5 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Navigation Controls (RTL aware: Right = Back in RTL, Left = Forward) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => canGoBack && setHistoryIndex((i) => i - 1)}
              title="العودة"
              aria-label="العودة"
              className="p-2 rounded-full text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!canGoForward}
              onClick={() => canGoForward && setHistoryIndex((i) => i + 1)}
              title="الأمام"
              aria-label="الأمام"
              className="p-2 rounded-full text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIframeLoading(true);
                setReloadNonce((n) => n + 1);
              }}
              title="إعادة تحميل"
              aria-label="إعادة تحميل"
              className="p-2 rounded-full text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] transition-colors cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isPreviewLoading || iframeLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Address Bar */}
          <form onSubmit={handleAddressSubmit} className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] focus-within:border-[#1a73e8] dark:focus-within:border-[#8ab4f8]">
              {currentUrl.startsWith('https://') ? (
                <Lock className="w-3.5 h-3.5 text-[#34A853] shrink-0" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[#5f6368] shrink-0" />
              )}
              <input
                type="text"
                dir="ltr"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                aria-label="عنوان الموقع"
                className="w-full bg-transparent text-xs sm:text-sm text-[#202124] dark:text-[#e8eaed] focus:outline-none text-left"
              />
            </div>
          </form>

          {/* Mode Toggle + Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="inline-flex items-center p-0.5 rounded-full bg-[#e8eaed] dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043]"
              role="group"
              aria-label="وضع عرض الموقع"
            >
              <button
                type="button"
                onClick={() => setViewMode('iframe')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'iframe'
                    ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs'
                    : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>عرض الموقع</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('reader')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'reader'
                    ? 'bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs'
                    : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>وضع القراءة</span>
              </button>
            </div>

            {hasTranslator && (
              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    `https://translate.google.com/translate?sl=auto&tl=ar&u=${encodeURIComponent(currentUrl)}`,
                    `ترجمة: ${displayTitle}`
                  )
                }
                title="ترجمة الصفحة للعربية"
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-white dark:hover:bg-[#303134] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>ترجمة</span>
              </button>
            )}

            {hasNotesExt && (
              <button
                type="button"
                onClick={() => setShowNotesPanel((s) => !s)}
                title="ملاحظات الصفحة"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showNotesPanel
                    ? 'border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#283142] text-[#1a73e8] dark:text-[#8ab4f8]'
                    : 'border-[#dadce0] dark:border-[#5f6368] text-[#5f6368] dark:text-[#bdc1c6] hover:bg-white dark:hover:bg-[#303134]'
                }`}
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span className="hidden md:inline">ملاحظات</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenExtensions}
              title="إدارة الإضافات"
              aria-label="إدارة الإضافات"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] text-[#5f6368] dark:text-[#bdc1c6] hover:bg-white dark:hover:bg-[#303134] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Puzzle className="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#8ab4f8]" />
              <span className="font-mono tabular-nums">{activeExtCount}</span>
            </button>

            <button
              type="button"
              onClick={handleBookmarkClick}
              title={bookmarked ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
              aria-label={bookmarked ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                bookmarked
                  ? 'text-[#fbbc04] bg-[#fef7e0] dark:bg-[#332b14]'
                  : 'text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043]'
              }`}
            >
              <Star className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
            </button>

            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="فتح في متصفح خارجي"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] text-[#202124] dark:text-[#e8eaed] hover:bg-white dark:hover:bg-[#303134] transition-colors whitespace-nowrap shrink-0"
            >
              <span>فتح خارجياً</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المتصفح المدمج"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#202124] dark:bg-[#e8eaed] text-white dark:text-[#202124] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Browser Viewport + Optional Extension Notes Drawer */}
      <div className="flex-1 flex relative overflow-hidden bg-white dark:bg-[#171717]">
        <div className="flex-1 relative overflow-hidden">
        {viewMode === 'iframe' ? (
          <div className="w-full h-full relative bg-white">
            {(isPreviewLoading || iframeLoading) && (
              <div className="absolute inset-x-0 top-0 h-1 bg-[#e8f0fe] dark:bg-[#303134] overflow-hidden z-10">
                <div className="h-full w-1/3 bg-[#1a73e8] animate-pulse" />
              </div>
            )}
            {!activeFrameSrc ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#171717] text-[#5f6368] dark:text-[#9aa0a6]">
                <Loader2 className="w-7 h-7 animate-spin text-[#1a73e8]" />
                <p className="text-sm font-medium">جارٍ فتح الموقع داخل متصفح نوفا...</p>
                <p dir="ltr" className="text-xs opacity-75 truncate max-w-md px-4">
                  {currentUrl}
                </p>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                key={`${activeFrameSrc}_${reloadNonce}`}
                src={activeFrameSrc}
                title={displayTitle}
                sandbox={
                  shouldUseProxy
                    ? 'allow-scripts allow-forms allow-popups'
                    : 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'
                }
                referrerPolicy="no-referrer"
                onLoad={() => setIframeLoading(false)}
                className="w-full h-full border-0 bg-white"
              />
            )}
          </div>
        ) : (
          <div className={`w-full h-full overflow-y-auto px-4 sm:px-8 py-8 transition-colors ${readerContainerClass}`}>
            <div className="max-w-3xl mx-auto">
              {isPreviewLoading ? (
                <div className="space-y-4 py-6">
                  <div className="flex items-center gap-2 text-sm text-[#5f6368] dark:text-[#9aa0a6]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1a73e8]" />
                    <span>جارٍ جلب محتوى الصفحة...</span>
                  </div>
                  <div className="h-8 w-3/4 rounded-lg bg-[#f1f3f4] dark:bg-[#303134] animate-pulse" />
                  <div className="h-4 w-full rounded bg-[#f1f3f4] dark:bg-[#303134] animate-pulse" />
                  <div className="h-4 w-11/12 rounded bg-[#f1f3f4] dark:bg-[#303134] animate-pulse" />
                  <div className="h-4 w-4/5 rounded bg-[#f1f3f4] dark:bg-[#303134] animate-pulse" />
                </div>
              ) : previewError ? (
                <div className="p-6 rounded-2xl border border-[#fad2cf] dark:border-[#5c2b29] bg-[#fce8e6] dark:bg-[#3c1e1e] text-[#c5221f] dark:text-[#f28b82]">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-1">{previewError}</p>
                      <p className="text-xs opacity-90 mb-4">
                        يمكنك فتح الموقع مباشرة في نافذة خارجية أو إعادة المحاولة.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReloadNonce((n) => n + 1)}
                          className="px-4 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#5f6368] cursor-pointer"
                        >
                          إعادة المحاولة
                        </button>
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[#1a73e8] text-white"
                        >
                          <span>فتح في متصفح خارجي</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : previewData ? (
                <article className="space-y-6">
                  {/* Reader Header */}
                  <div className="pb-5 border-b border-[#e8eaed] dark:border-[#3c4043]">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                        <span>{previewData.siteName}</span>
                        <span aria-hidden="true">·</span>
                        <span dir="ltr" className="truncate max-w-[240px]">
                          {displayHost}
                        </span>
                      </div>
                      {readerArticleText && (
                        <TtsButton text={readerArticleText} label="استماع للصفحة" />
                      )}
                    </div>

                    <h1
                      dir="auto"
                      className="text-2xl sm:text-3xl font-bold text-[#202124] dark:text-[#e8eaed] leading-snug"
                    >
                      {previewData.title}
                    </h1>

                    {previewData.description && (
                      <p
                        dir="auto"
                        className="mt-3 text-base text-[#5f6368] dark:text-[#bdc1c6] leading-relaxed"
                      >
                        {previewData.description}
                      </p>
                    )}
                  </div>

                  {previewData.heroImage && !heroFailed && isSafeHttpUrl(previewData.heroImage) && (
                    <div className="rounded-2xl overflow-hidden border border-[#e8eaed] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] max-h-80">
                      <img
                        src={previewData.heroImage}
                        alt={previewData.title}
                        referrerPolicy="no-referrer"
                        onError={() => setHeroFailed(true)}
                        className="w-full h-full max-h-80 object-cover"
                      />
                    </div>
                  )}

                  {/* Extracted Readable Blocks */}
                  {visibleBlocks.length > 0 ? (
                    <div className="space-y-4">
                      {visibleBlocks.map((block, idx) => {
                        if (block.type === 'h1') {
                          return (
                            <h2
                              key={idx}
                              dir="auto"
                              className="text-xl font-bold pt-2"
                            >
                              {block.text}
                            </h2>
                          );
                        }
                        if (block.type === 'h2' || block.type === 'h3') {
                          return (
                            <h3
                              key={idx}
                              dir="auto"
                              className="text-lg font-semibold pt-2"
                            >
                              {block.text}
                            </h3>
                          );
                        }
                        if (block.type === 'li') {
                          return (
                            <li
                              key={idx}
                              dir="auto"
                              className={`${readerFontClass} mr-5 list-disc opacity-90`}
                            >
                              {block.text}
                            </li>
                          );
                        }
                        return (
                          <p
                            key={idx}
                            dir="auto"
                            className={`${readerFontClass} opacity-90`}
                          >
                            {block.text}
                          </p>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl border border-[#e8eaed] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] text-center">
                      <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mb-4">
                        يعتمد هذا الموقع على تطبيق تفاعلي أو لا يحتوي على نصوص مقروءة مباشرة.
                      </p>
                      <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-medium bg-[#1a73e8] text-white hover:bg-[#1557b0]"
                      >
                        <span>فتح الموقع الكامل في نافذة خارجية</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Clickable Page Links (navigate inside NOVA In-App Browser) */}
                  {previewData.links.length > 0 && (
                    <div className="pt-6 border-t border-[#e8eaed] dark:border-[#3c4043]">
                      <h3 className="text-sm font-bold text-[#202124] dark:text-[#e8eaed] mb-3">
                        روابط داخل الصفحة
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {previewData.links.map((lnk, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => navigateTo(lnk.url, lnk.text)}
                            className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[#e8eaed] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#28292c] text-right transition-colors cursor-pointer"
                          >
                            <span
                              dir="auto"
                              className="text-xs font-medium text-[#1a73e8] dark:text-[#8ab4f8] truncate"
                            >
                              {lnk.text}
                            </span>
                            <Globe className="w-3.5 h-3.5 text-[#9aa0a6] shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ) : null}
            </div>
          </div>
        )}
        </div>

        {/* Page Notes Extension Side Panel */}
        {hasNotesExt && showNotesPanel && (
          <aside className="w-80 shrink-0 border-r border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124] flex flex-col">
            <div className="px-4 py-3 border-b border-[#e8eaed] dark:border-[#3c4043] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">ملاحظات هذا الموقع</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesPanel(false)}
                aria-label="إغلاق الملاحظات"
                className="p-1 rounded-full hover:bg-[#e8eaed] dark:hover:bg-[#303134] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!noteDraft.trim()) return;
                onAddNote(currentUrl, displayTitle, noteDraft.trim());
                setNoteDraft('');
              }}
              className="p-4 border-b border-[#e8eaed] dark:border-[#3c4043] space-y-2.5"
            >
              <textarea
                dir="auto"
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="اكتب ملاحظة أو اقتباساً حول هذه الصفحة..."
                className="w-full p-3 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#28292c] text-xs leading-relaxed focus:outline-none focus:border-[#1a73e8]"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-full text-xs font-medium bg-[#1a73e8] text-white hover:bg-[#1557b0] cursor-pointer"
              >
                حفظ الملاحظة
              </button>
            </form>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pageNotes.length === 0 ? (
                <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] text-center py-6">
                  لا توجد ملاحظات محفوظة لهذا الرابط بعد.
                </p>
              ) : (
                pageNotes.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl bg-white dark:bg-[#28292c] border border-[#e8eaed] dark:border-[#3c4043] space-y-1.5"
                  >
                    <p dir="auto" className="text-xs leading-relaxed whitespace-pre-line">
                      {n.content}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                      <span>{new Date(n.createdAt).toLocaleDateString('ar-EG')}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(n.id)}
                        aria-label="حذف الملاحظة"
                        className="text-[#d93025] hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
