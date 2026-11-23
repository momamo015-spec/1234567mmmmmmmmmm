import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Calculator,
  Download,
  Globe,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Languages,
  LayoutGrid,
  LogOut,
  MapPin,
  Moon,
  Newspaper,
  Plus,
  Puzzle,
  Search,
  Sun,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  BookmarkEntry,
  DriveFileItem,
  EngineMode,
  ExtensionNoteEntry,
  GoogleApiConfig,
  GroundingSummary,
  KnowledgeGraphData,
  NovaAccount,
  NovaExtension,
  SearchHistoryEntry,
  SearchResultItem,
  SearchTab,
  ShortcutEntry,
  ThemeMode,
} from './types';
import {
  auth,
  deleteFirestoreBookmark,
  getCachedDriveToken,
  initFirebaseAuth,
  loadFirestoreBookmarks,
  loadFirestoreHistory,
  saveFirestoreBookmark,
  saveFirestoreHistory,
  saveFirestoreShortcut,
  signInWithGoogleForNova,
  signOutFirebase,
  syncFirestoreUserProfile,
} from './lib/firebase';
import {
  DEFAULT_EXTENSIONS_CATALOG,
  isExtensionActive,
  mergeWithDefaultCatalog,
  resolveSearchBang,
} from './lib/extensionsCatalog';
import {
  evaluateMathQuery,
  fetchInstantAndDuckDuckGo,
  getFaviconUrl,
  isSafeHttpUrl,
  normalizeUrl,
} from './lib/searchHelpers';
import { AccountChooser } from './components/AccountChooser';
import { ApiConfigModal } from './components/ApiConfigModal';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { DesktopLauncherModal } from './components/DesktopLauncherModal';
import { ExtensionsModal } from './components/ExtensionsModal';
import { InAppBrowser } from './components/InAppBrowser';
import { NovaLogo } from './components/NovaLogo';
import { RecentSearchesSidebar } from './components/RecentSearchesSidebar';
import { SearchBar } from './components/SearchBar';
import { SerpView } from './components/SerpView';
import { ShortcutModal } from './components/ShortcutModal';

const STORAGE_ACCOUNTS_KEY = 'nova_accounts_v1';
const STORAGE_THEME_KEY = 'nova_theme_v1';
const STORAGE_API_CONFIG_KEY = 'nova_google_api_config_v1';

const DEFAULT_ACCOUNTS: NovaAccount[] = [
  {
    id: 'default_nova_user',
    name: 'مستخدم نوفا',
    email: 'user@nova.com',
    avatarColor: '#4285F4',
    statusLabel: 'جاهز',
  },
];

const DEFAULT_SHORTCUTS: ShortcutEntry[] = [
  { id: 'sc_youtube', title: 'يوتيوب', url: 'https://www.youtube.com', iconColor: '#EA4335' },
  { id: 'sc_wiki', title: 'ويكيبيديا', url: 'https://ar.wikipedia.org', iconColor: '#4285F4' },
  { id: 'sc_news', title: 'الأخبار', url: 'https://news.google.com', iconColor: '#34A853' },
  { id: 'sc_translate', title: 'الترجمة', url: 'https://translate.google.com', iconColor: '#1A73E8' },
  { id: 'sc_maps', title: 'الخرائط', url: 'https://maps.google.com', iconColor: '#FBBC05' },
];

const LUCKY_TOPICS = [
  'الذكاء الاصطناعي في الطب الحديث',
  'تاريخ بيت الحكمة في بغداد',
  'تلسكوب جيمس ويب الفضائي',
  'الحوسبة الكمومية ومستقبل التشفير',
  'الطاقة الشمسية وتحلية المياه',
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Accounts & Session
  const [accounts, setAccounts] = useState<NovaAccount[]>(() =>
    loadFromStorage<NovaAccount[]>(STORAGE_ACCOUNTS_KEY, DEFAULT_ACCOUNTS)
  );
  const [activeAccount, setActiveAccount] = useState<NovaAccount | null>(null);
  const [view, setView] = useState<'chooser' | 'home' | 'serp'>('chooser');

  // Firebase Auth & Drive token (token held strictly in memory)
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);

  // API & Search Preferences (no cx required)
  const [apiConfig, setApiConfig] = useState<GoogleApiConfig>(() =>
    loadFromStorage<GoogleApiConfig>(STORAGE_API_CONFIG_KEY, {
      apiKey: '',
      preferredLang: 'auto',
    })
  );

  // Search State
  const [searchInput, setSearchInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [engineMode, setEngineMode] = useState<EngineMode>('hybrid');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Results State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleResults, setGoogleResults] = useState<SearchResultItem[]>([]);
  const [instantResults, setInstantResults] = useState<SearchResultItem[]>([]);
  const [imageResults, setImageResults] = useState<SearchResultItem[]>([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphData | null>(null);
  const [mathResult, setMathResult] = useState<{ expression: string; result: string } | null>(null);

  // Gemini Search Grounding State
  const [groundingSummary, setGroundingSummary] = useState<GroundingSummary | null>(null);
  const [isGroundingLoading, setIsGroundingLoading] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);

  // Google Drive Search State
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Per-account Data
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutEntry[]>(DEFAULT_SHORTCUTS);
  const [extensions, setExtensions] = useState<NovaExtension[]>(DEFAULT_EXTENSIONS_CATALOG);
  const [extensionNotes, setExtensionNotes] = useState<ExtensionNoteEntry[]>([]);

  // Popovers, Modals & In-App Browser
  const [showApiModal, setShowApiModal] = useState(false);
  const [showBookmarksDrawer, setShowBookmarksDrawer] = useState(false);
  const [showExtensionsModal, setShowExtensionsModal] = useState(false);
  const [showLauncherModal, setShowLauncherModal] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [showAccountPopover, setShowAccountPopover] = useState(false);
  const [browserTarget, setBrowserTarget] = useState<{ url: string; title?: string } | null>(null);

  const openInAppBrowser = useCallback((url: string, title?: string) => {
    if (isSafeHttpUrl(url)) {
      setBrowserTarget({ url, title });
    }
  }, []);

  const launcherRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const groundingCacheRef = useRef<Map<string, GroundingSummary>>(new Map());

  // Apply Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  }, [theme]);

  // Persist accounts list
  useEffect(() => {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
  }, [accounts]);

  // Persist API Config
  const handleSaveApiConfig = (newCfg: GoogleApiConfig) => {
    setApiConfig(newCfg);
    localStorage.setItem(STORAGE_API_CONFIG_KEY, JSON.stringify(newCfg));
  };

  const handleClearApiConfig = () => {
    const empty: GoogleApiConfig = { apiKey: '', preferredLang: 'auto' };
    setApiConfig(empty);
    localStorage.setItem(STORAGE_API_CONFIG_KEY, JSON.stringify(empty));
  };

  // Close popovers on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) {
        setShowAppLauncher(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = initFirebaseAuth((user, token) => {
      if (user) {
        setFirebaseUid(user.uid);
        if (token) setDriveAccessToken(token);
      } else {
        setFirebaseUid(null);
        setDriveAccessToken(null);
      }
    });
    return () => unsub();
  }, []);

  // Load account-specific data from localStorage + Cloud SQL + Firestore
  const loadAccountData = useCallback(async (acc: NovaAccount) => {
    if (acc.isGuest) {
      setHistory([]);
      setBookmarks([]);
      setShortcuts(DEFAULT_SHORTCUTS);
      setExtensions(DEFAULT_EXTENSIONS_CATALOG);
      setExtensionNotes([]);
      return;
    }

    const localHistory = loadFromStorage<SearchHistoryEntry[]>(`nova_history_${acc.id}`, []);
    const localBookmarks = loadFromStorage<BookmarkEntry[]>(`nova_bookmarks_${acc.id}`, []);
    const localShortcuts = loadFromStorage<ShortcutEntry[]>(
      `nova_shortcuts_${acc.id}`,
      DEFAULT_SHORTCUTS
    );
    const localExtensions = loadFromStorage<NovaExtension[]>(`nova_extensions_${acc.id}`, []);
    const localExtNotes = loadFromStorage<ExtensionNoteEntry[]>(`nova_ext_notes_${acc.id}`, []);

    setHistory(localHistory);
    setBookmarks(localBookmarks);
    setShortcuts(localShortcuts);
    setExtensions(
      localExtensions.length > 0
        ? mergeWithDefaultCatalog(localExtensions)
        : DEFAULT_EXTENSIONS_CATALOG
    );
    setExtensionNotes(localExtNotes);

    if (acc.isGoogleAccount && auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        const syncRes = await fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            displayName: acc.name,
            avatarColor: acc.avatarColor,
            preferredEngine: engineMode,
            theme,
          }),
        });
        if (syncRes.ok) {
          const data = await syncRes.json();
          if (Array.isArray(data.history) && data.history.length > 0) {
            setHistory(
              data.history.map((h: { id: number; query: string; engineMode: EngineMode; tab: SearchTab; createdAt: string }) => ({
                id: `sql_${h.id}`,
                query: h.query,
                engineMode: h.engineMode,
                tab: h.tab,
                createdAt: new Date(h.createdAt).getTime(),
              }))
            );
          }
          if (Array.isArray(data.bookmarks) && data.bookmarks.length > 0) {
            setBookmarks(
              data.bookmarks.map((b: { id: number; title: string; url: string; snippet: string; displayLink: string; sourceType: BookmarkEntry['sourceType']; createdAt: string }) => ({
                id: `sql_b_${b.id}`,
                title: b.title,
                url: b.url,
                snippet: b.snippet,
                displayLink: b.displayLink,
                sourceType: b.sourceType,
                createdAt: new Date(b.createdAt).getTime(),
              }))
            );
          }
          if (Array.isArray(data.shortcuts) && data.shortcuts.length > 0) {
            setShortcuts(
              data.shortcuts.map((s: { id: number; title: string; url: string; iconColor: string }) => ({
                id: `sql_s_${s.id}`,
                dbId: s.id,
                title: s.title,
                url: s.url,
                iconColor: s.iconColor,
              }))
            );
          }
        }
      } catch (err) {
        console.warn('Cloud SQL sync fallback to local/Firestore:', err);
      }

      try {
        await syncFirestoreUserProfile(auth.currentUser, {
          avatarColor: acc.avatarColor,
          preferredEngine: engineMode,
          theme,
        });
        const [fsHistory, fsBookmarks] = await Promise.all([
          loadFirestoreHistory(auth.currentUser.uid),
          loadFirestoreBookmarks(auth.currentUser.uid),
        ]);
        if (fsHistory.length > 0) {
          setHistory((prev) => (prev.length > 0 ? prev : fsHistory));
        }
        if (fsBookmarks.length > 0) {
          setBookmarks((prev) => (prev.length > 0 ? prev : fsBookmarks));
        }
      } catch (err) {
        console.warn('Firestore sync notice:', err);
      }
    }
  }, [engineMode, theme]);

  const handleSelectAccount = (acc: NovaAccount) => {
    const updatedAccounts = accounts.map((a) => ({
      ...a,
      statusLabel: a.id === acc.id ? 'مسجّل الدخول' : 'جاهز',
    }));
    setAccounts(updatedAccounts);
    setActiveAccount({ ...acc, statusLabel: 'مسجّل الدخول' });
    setView('home');
    loadAccountData(acc);
  };

  const handleCreateAccount = (name: string, email: string, avatarColor: string) => {
    const newAcc: NovaAccount = {
      id: `local_${Date.now()}`,
      name,
      email,
      avatarColor,
      statusLabel: 'مسجّل الدخول',
    };
    const nextList = [
      newAcc,
      ...accounts.map((a) => ({ ...a, statusLabel: 'جاهز' })),
    ];
    setAccounts(nextList);
    setActiveAccount(newAcc);
    setView('home');
    loadAccountData(newAcc);
  };

  const handleRemoveAccount = (accountId: string) => {
    const next = accounts.filter((a) => a.id !== accountId);
    setAccounts(next.length ? next : DEFAULT_ACCOUNTS);
    localStorage.removeItem(`nova_history_${accountId}`);
    localStorage.removeItem(`nova_bookmarks_${accountId}`);
    localStorage.removeItem(`nova_shortcuts_${accountId}`);
  };

  const handleContinueGuest = () => {
    const guest: NovaAccount = {
      id: 'guest_incognito',
      name: 'ضيف (تصفح خفي)',
      email: 'incognito@nova.local',
      avatarColor: '#5F6368',
      isGuest: true,
      statusLabel: 'وضع التصفح الخفي',
    };
    setActiveAccount(guest);
    setView('home');
    loadAccountData(guest);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setGoogleAuthError(null);
    try {
      const { user, accessToken } = await signInWithGoogleForNova();
      setFirebaseUid(user.uid);
      setDriveAccessToken(accessToken);

      const googleAccount: NovaAccount = {
        id: `google_${user.uid}`,
        name: user.displayName || 'مستخدم Google',
        email: user.email || '',
        avatarColor: '#4285F4',
        photoURL: user.photoURL || undefined,
        isGoogleAccount: true,
        statusLabel: 'مسجّل الدخول',
      };

      setAccounts((prev) => {
        const filtered = prev
          .filter((a) => a.id !== googleAccount.id)
          .map((a) => ({ ...a, statusLabel: 'جاهز' }));
        return [googleAccount, ...filtered];
      });
      setActiveAccount(googleAccount);
      setView('home');
      await loadAccountData(googleAccount);
    } catch (error: unknown) {
      console.error('Google Sign-In failed:', error);
      setGoogleAuthError('تعذر إتمام تسجيل الدخول بحساب Google. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleSignOutGoogle = async () => {
    await signOutFirebase();
    setFirebaseUid(null);
    setDriveAccessToken(null);
    setShowAccountPopover(false);
    setView('chooser');
    setActiveAccount(null);
  };

  // Fetch Drive files when tab === 'drive'
  const fetchDriveSearch = useCallback(
    async (q: string) => {
      const token = driveAccessToken || getCachedDriveToken();
      if (!token) {
        setDriveFiles([]);
        return;
      }
      setIsDriveLoading(true);
      setDriveError(null);
      try {
        const escaped = q.replace(/'/g, "\\'");
        const driveQuery = q.trim()
          ? `trashed = false and (name contains '${escaped}' or fullText contains '${escaped}')`
          : 'trashed = false';
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          driveQuery
        )}&pageSize=20&fields=files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size)`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setDriveAccessToken(null);
            throw new Error('انتهت صلاحية جلسة Google Drive. يرجى إعادة تسجيل الدخول بحساب Google.');
          }
          throw new Error(data?.error?.message || 'تعذر البحث في Google Drive.');
        }
        setDriveFiles(Array.isArray(data.files) ? data.files : []);
      } catch (err: unknown) {
        setDriveError(err instanceof Error ? err.message : 'حدث خطأ أثناء البحث في Google Drive.');
      } finally {
        setIsDriveLoading(false);
      }
    },
    [driveAccessToken]
  );

  // Save search summary to Google Drive (only called after explicit user confirmation dialog!)
  const handleSaveSummaryToDrive = async (summaryText: string) => {
    const token = driveAccessToken || getCachedDriveToken();
    if (!token) {
      throw new Error('يرجى تسجيل الدخول بحساب Google أولاً.');
    }

    const metadata = {
      name: `ملخص نوفا - ${submittedQuery}.txt`,
      mimeType: 'text/plain',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append(
      'file',
      new Blob([`استعلام البحث: ${submittedQuery}\n\n${summaryText}`], {
        type: 'text/plain;charset=utf-8',
      })
    );

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) {
      throw new Error('تعذر حفظ الملف في Google Drive. تأكد من صلاحيات الحساب.');
    }
  };

  // Core Search Execution
  const executeSearch = useCallback(
    async (
      rawQuery: string,
      tabOverride?: SearchTab,
      engineOverride?: EngineMode,
      pageOverride = 1
    ) => {
      let q = rawQuery.trim();
      if (!q) return;

      let targetTab = tabOverride ?? activeTab;
      const targetEngine = engineOverride ?? engineMode;

      // Resolve Quick Search Bangs extension (!w, !yt, !img, !n, !d, or custom !triggers)
      if (!tabOverride && pageOverride === 1) {
        const bang = resolveSearchBang(q, extensions);
        if (bang?.type === 'open_url') {
          openInAppBrowser(bang.url, bang.title);
          return;
        }
        if (bang?.type === 'tab') {
          targetTab = bang.tab;
          setActiveTab(bang.tab);
          q = bang.cleanQuery;
        }

        // If user entered a direct website URL or web domain (e.g. https://..., www..., wikipedia.org), open it directly inside the in-app browser
        const isExplicitUrl = /^https?:\/\/\S+$/i.test(q) || /^www\.\S+\.\S+$/i.test(q);
        const domainMatch = q.match(
          /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.([a-zA-Z]{2,12})(?:[/?#]\S*)?$/
        );
        const fileExts = new Set([
          'js', 'ts', 'tsx', 'jsx', 'py', 'json', 'txt', 'pdf', 'png', 'jpg', 'jpeg', 'css', 'html', 'md', 'cpp', 'xml', 'csv',
        ]);
        const isWebDomain = Boolean(domainMatch && !fileExts.has(domainMatch[1].toLowerCase()));
        if (isExplicitUrl || isWebDomain) {
          const directUrl = normalizeUrl(q);
          if (isSafeHttpUrl(directUrl)) {
            openInAppBrowser(directUrl);
            return;
          }
        }
      }

      setSearchInput(q);
      setSubmittedQuery(q);
      setCurrentPage(pageOverride);
      setView('serp');
      setErrorMsg(null);

      // Evaluate Math Calculator (when Smart Calculator extension is active)
      setMathResult(
        isExtensionActive(extensions, 'smart_calculator') ? evaluateMathQuery(q) : null
      );

      // Save History (unless Guest)
      if (activeAccount && !activeAccount.isGuest && pageOverride === 1) {
        const entry: SearchHistoryEntry = {
          id: `h_${Date.now()}`,
          query: q,
          engineMode: targetEngine,
          tab: targetTab,
          createdAt: Date.now(),
        };
        setHistory((prev) => {
          const deduped = [entry, ...prev.filter((i) => i.query !== q)].slice(0, 30);
          localStorage.setItem(`nova_history_${activeAccount.id}`, JSON.stringify(deduped));
          return deduped;
        });

        if (activeAccount.isGoogleAccount && auth.currentUser) {
          auth.currentUser
            .getIdToken()
            .then((idToken) =>
              fetch('/api/history', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ query: q, engineMode: targetEngine, tab: targetTab }),
              })
            )
            .catch(() => {});
          saveFirestoreHistory(auth.currentUser.uid, {
            query: q,
            engineMode: targetEngine,
            tab: targetTab,
          }).catch(() => {});
        }
      }

      if (targetTab === 'drive') {
        await fetchDriveSearch(q);
        return;
      }

      // Client-side pagination when staying on same query & tab
      if (pageOverride > 1 && q === submittedQuery && targetTab === activeTab) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setIsLoading(true);
      const preferredLang = apiConfig.preferredLang || 'auto';

      const instantPromise = fetchInstantAndDuckDuckGo(q, targetTab, preferredLang);

      const mapSourcesToResults = (sources: { uri: string; title: string }[]): SearchResultItem[] =>
        sources
          .filter((src) => isSafeHttpUrl(src.uri))
          .map((src, idx) => {
            let host = 'google.com';
            try {
              host = new URL(src.uri).hostname;
            } catch {
              // ignore
            }
            return {
              id: `gs_${idx}`,
              title: src.title || host,
              url: src.uri,
              displayLink: host,
              snippet: `نتيجة بحث حية مرتبطة بـ «${q}»`,
              favicon: getFaviconUrl(src.uri),
              source: 'google' as const,
            };
          });

      // Trigger Gemini Search Grounding in parallel on page 1 for All / News (using client cache to avoid redundant calls)
      if (pageOverride === 1 && (targetTab === 'all' || targetTab === 'news')) {
        const cacheKey = q.toLowerCase();
        const cached = groundingCacheRef.current.get(cacheKey);
        if (cached) {
          setGroundingSummary(cached);
          setGoogleResults(mapSourcesToResults(cached.sources));
          setGroundingError(null);
          setIsGroundingLoading(false);
        } else {
          setIsGroundingLoading(true);
          setGroundingError(null);
          setGroundingSummary(null);
          setGoogleResults([]);
          fetch('/api/gemini/search-grounding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q }),
          })
            .then(async (res) => {
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'تعذر جلب الملخص الذكي.');
              const result: GroundingSummary = {
                summary: data.summary || '',
                sources: Array.isArray(data.sources) ? data.sources : [],
              };
              if (result.summary) {
                groundingCacheRef.current.set(cacheKey, result);
              }
              setGroundingSummary(result);
              setGoogleResults(mapSourcesToResults(result.sources));
            })
            .catch((err) => {
              setGroundingError(err instanceof Error ? err.message : 'تعذر جلب الملخص الذكي.');
            })
            .finally(() => setIsGroundingLoading(false));
        }
      } else {
        setGoogleResults([]);
      }

      try {
        const instantRes = await instantPromise;
        if (targetTab === 'images') {
          setImageResults(instantRes.imageItems);
          setInstantResults([]);
          setKnowledgeGraph(null);
        } else {
          setImageResults([]);
          setInstantResults(instantRes.instantItems);
          setKnowledgeGraph(instantRes.knowledgeGraph);
        }
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error ? err.message : 'حدث خطأ أثناء جلب نتائج البحث.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeAccount,
      activeTab,
      apiConfig.preferredLang,
      engineMode,
      extensions,
      fetchDriveSearch,
      openInAppBrowser,
      submittedQuery,
    ]
  );

  // Extension Handlers
  const persistExtensions = useCallback(
    (next: NovaExtension[]) => {
      setExtensions(next);
      if (activeAccount && !activeAccount.isGuest) {
        localStorage.setItem(`nova_extensions_${activeAccount.id}`, JSON.stringify(next));
      }
    },
    [activeAccount]
  );

  const handleToggleInstallExtension = (id: string, installed: boolean) => {
    persistExtensions(
      extensions.map((ext) =>
        ext.id === id ? { ...ext, installed, enabled: installed } : ext
      )
    );
  };

  const handleToggleEnableExtension = (id: string) => {
    persistExtensions(
      extensions.map((ext) =>
        ext.id === id ? { ...ext, enabled: !ext.enabled } : ext
      )
    );
  };

  const handleUpdateExtensionSettings = (
    id: string,
    settings: NonNullable<NovaExtension['settings']>
  ) => {
    persistExtensions(
      extensions.map((ext) => (ext.id === id ? { ...ext, settings } : ext))
    );
  };

  const handleAddCustomExtension = (custom: {
    name: string;
    description: string;
    trigger: string;
    targetUrlTemplate: string;
  }) => {
    const newExt: NovaExtension = {
      id: `custom_ext_${Date.now()}`,
      name: custom.name,
      description: custom.description,
      category: 'مخصصة',
      version: '1.0',
      author: activeAccount?.name || 'مستخدم نوفا',
      iconColor: '#1A73E8',
      installed: true,
      enabled: true,
      isCustom: true,
      customRule: {
        trigger: custom.trigger,
        targetUrlTemplate: custom.targetUrlTemplate,
      },
    };
    persistExtensions([...extensions, newExt]);
  };

  const handleDeleteCustomExtension = (id: string) => {
    persistExtensions(extensions.filter((ext) => ext.id !== id));
  };

  const handleAddExtensionNote = (url: string, pageTitle: string, content: string) => {
    const nextNote: ExtensionNoteEntry = {
      id: `note_${Date.now()}`,
      url,
      pageTitle,
      content,
      createdAt: Date.now(),
    };
    const next = [nextNote, ...extensionNotes];
    setExtensionNotes(next);
    if (activeAccount && !activeAccount.isGuest) {
      localStorage.setItem(`nova_ext_notes_${activeAccount.id}`, JSON.stringify(next));
    }
  };

  const handleDeleteExtensionNote = (noteId: string) => {
    const next = extensionNotes.filter((n) => n.id !== noteId);
    setExtensionNotes(next);
    if (activeAccount && !activeAccount.isGuest) {
      localStorage.setItem(`nova_ext_notes_${activeAccount.id}`, JSON.stringify(next));
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    if (activeAccount && !activeAccount.isGuest) {
      localStorage.removeItem(`nova_history_${activeAccount.id}`);
      if (activeAccount.isGoogleAccount && auth.currentUser) {
        auth.currentUser
          .getIdToken()
          .then((idToken) =>
            fetch('/api/history', {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            })
          )
          .catch(() => {});
      }
    }
  };

  const handleSelectHistoryEntry = (entry: SearchHistoryEntry) => {
    setActiveTab(entry.tab);
    setEngineMode(entry.engineMode);
    executeSearch(entry.query, entry.tab, entry.engineMode, 1);
  };

  const handleLuckySearch = () => {
    if (searchInput.trim()) {
      executeSearch(searchInput.trim(), 'all', engineMode, 1);
    } else {
      const randomTopic = LUCKY_TOPICS[Math.floor(Math.random() * LUCKY_TOPICS.length)];
      executeSearch(randomTopic, 'all', engineMode, 1);
    }
  };

  const handleToggleBookmark = (item: SearchResultItem) => {
    if (!activeAccount) return;
    const exists = bookmarks.some((b) => b.url === item.url);

    if (exists) {
      const existing = bookmarks.find((b) => b.url === item.url);
      const next = bookmarks.filter((b) => b.url !== item.url);
      setBookmarks(next);
      if (!activeAccount.isGuest) {
        localStorage.setItem(`nova_bookmarks_${activeAccount.id}`, JSON.stringify(next));
        if (activeAccount.isGoogleAccount && auth.currentUser) {
          auth.currentUser
            .getIdToken()
            .then((idToken) =>
              fetch('/api/bookmarks', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ url: item.url }),
              })
            )
            .catch(() => {});
          if (existing) {
            deleteFirestoreBookmark(auth.currentUser.uid, existing.id).catch(() => {});
          }
        }
      }
    } else {
      const newBookmark: BookmarkEntry = {
        id: `b_${Date.now()}`,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        displayLink: item.displayLink,
        sourceType: item.source,
        createdAt: Date.now(),
      };
      const next = [newBookmark, ...bookmarks];
      setBookmarks(next);
      if (!activeAccount.isGuest) {
        localStorage.setItem(`nova_bookmarks_${activeAccount.id}`, JSON.stringify(next));
        if (activeAccount.isGoogleAccount && auth.currentUser) {
          auth.currentUser
            .getIdToken()
            .then((idToken) =>
              fetch('/api/bookmarks', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify(newBookmark),
              })
            )
            .catch(() => {});
          saveFirestoreBookmark(auth.currentUser.uid, {
            title: newBookmark.title,
            url: newBookmark.url,
            snippet: newBookmark.snippet,
            displayLink: newBookmark.displayLink,
            sourceType: newBookmark.sourceType,
          }).catch(() => {});
        }
      }
    }
  };

  const handleRemoveBookmark = (url: string) => {
    const existing = bookmarks.find((b) => b.url === url);
    const next = bookmarks.filter((b) => b.url !== url);
    setBookmarks(next);
    if (activeAccount && !activeAccount.isGuest) {
      localStorage.setItem(`nova_bookmarks_${activeAccount.id}`, JSON.stringify(next));
      if (activeAccount.isGoogleAccount && auth.currentUser) {
        auth.currentUser
          .getIdToken()
          .then((idToken) =>
            fetch('/api/bookmarks', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ url }),
            })
          )
          .catch(() => {});
        if (existing) {
          deleteFirestoreBookmark(auth.currentUser.uid, existing.id).catch(() => {});
        }
      }
    }
  };

  const handleAddShortcut = (title: string, url: string, iconColor: string) => {
    const newSc: ShortcutEntry = {
      id: `sc_${Date.now()}`,
      title,
      url,
      iconColor,
    };
    const next = [...shortcuts, newSc].slice(0, 6);
    setShortcuts(next);
    if (activeAccount && !activeAccount.isGuest) {
      localStorage.setItem(`nova_shortcuts_${activeAccount.id}`, JSON.stringify(next));
      if (activeAccount.isGoogleAccount && auth.currentUser) {
        auth.currentUser
          .getIdToken()
          .then((idToken) =>
            fetch('/api/shortcuts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ title, url, iconColor }),
            })
          )
          .catch(() => {});
        saveFirestoreShortcut(auth.currentUser.uid, { title, url, iconColor }).catch(() => {});
      }
    }
  };

  const handleRemoveShortcut = (sc: ShortcutEntry) => {
    const next = shortcuts.filter((item) => item.id !== sc.id);
    setShortcuts(next);
    if (activeAccount && !activeAccount.isGuest) {
      localStorage.setItem(`nova_shortcuts_${activeAccount.id}`, JSON.stringify(next));
      if (activeAccount.isGoogleAccount && auth.currentUser && sc.dbId) {
        auth.currentUser
          .getIdToken()
          .then((idToken) =>
            fetch(`/api/shortcuts/${sc.dbId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${idToken}` },
            })
          )
          .catch(() => {});
      }
    }
  };

  const renderAccountControl = () => {
    if (!activeAccount) return null;
    const initial = activeAccount.name.trim().charAt(0).toUpperCase() || 'ن';

    return (
      <div ref={accountMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setShowAccountPopover((s) => !s)}
          aria-label="حساب المستخدم"
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm ring-2 ring-transparent hover:ring-[#dadce0] dark:hover:ring-[#5f6368] transition-all cursor-pointer shrink-0"
          style={{ backgroundColor: activeAccount.avatarColor }}
        >
          {activeAccount.photoURL ? (
            <img
              src={activeAccount.photoURL}
              alt={activeAccount.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            initial
          )}
        </button>

        {showAccountPopover && (
          <div className="absolute left-0 top-12 z-50 w-80 bg-[#e9eef6] dark:bg-[#28292c] rounded-[24px] shadow-2xl border border-[#dadce0] dark:border-[#3c4043] p-4">
            <div className="text-center text-xs text-[#5f6368] dark:text-[#9aa0a6] mb-3" dir="ltr">
              {activeAccount.email}
            </div>

            <div className="bg-white dark:bg-[#202124] rounded-2xl p-4 flex flex-col items-center text-center mb-3">
              <div
                className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-2xl mb-2.5"
                style={{ backgroundColor: activeAccount.avatarColor }}
              >
                {activeAccount.photoURL ? (
                  <img
                    src={activeAccount.photoURL}
                    alt={activeAccount.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <p className="font-bold text-base text-[#202124] dark:text-[#e8eaed]">
                مرحباً، {activeAccount.name}
              </p>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1">
                محرك نوفا المدمج نشط وجاهز للبحث الفوري
              </p>

              {!driveAccessToken && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountPopover(false);
                    handleGoogleSignIn();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f6fe] dark:hover:bg-[#283142] cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>ربط حساب Google و Drive</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowAccountPopover(false);
                  setView('chooser');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-[#202124] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] text-sm font-medium transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                <span>تبديل الحساب</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAccountPopover(false);
                  setView('chooser');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-[#202124] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] text-sm font-medium transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                <span>إضافة حساب آخر</span>
              </button>

              {firebaseUid && (
                <button
                  type="button"
                  onClick={handleSignOutGoogle}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-[#202124] hover:bg-[#fce8e6] dark:hover:bg-[#3c1e1e] text-sm font-medium text-[#d93025] dark:text-[#f28b82] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج من Google</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 1. Initial Screen: Choose an Account
  if (view === 'chooser' || !activeAccount) {
    return (
      <AccountChooser
        accounts={accounts}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onSelectAccount={handleSelectAccount}
        onCreateAccount={handleCreateAccount}
        onRemoveAccount={handleRemoveAccount}
        onContinueGuest={handleContinueGuest}
        onGoogleSignIn={handleGoogleSignIn}
        isGoogleSigningIn={isGoogleSigningIn}
        googleAuthError={googleAuthError}
      />
    );
  }

  // 2. Search Results View
  if (view === 'serp') {
    return (
      <>
        <SerpView
          query={submittedQuery}
          inputValue={searchInput}
          onInputChange={setSearchInput}
          onSubmitSearch={(q) => executeSearch(q, activeTab, engineMode, 1)}
          onGoHome={() => setView('home')}
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setActiveTab(tab);
            executeSearch(submittedQuery || searchInput, tab, engineMode, 1);
          }}
          engineMode={engineMode}
          onChangeEngine={(mode) => {
            setEngineMode(mode);
            executeSearch(submittedQuery || searchInput, activeTab, mode, 1);
          }}
          onOpenApiModal={() => setShowApiModal(true)}
          onOpenBookmarks={() => setShowBookmarksDrawer(true)}
          onOpenExtensions={() => setShowExtensionsModal(true)}
          activeExtensionsCount={extensions.filter((e) => e.installed && e.enabled).length}
          account={activeAccount}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          history={history}
          isLoading={isLoading}
          errorMsg={errorMsg}
          googleResults={googleResults}
          instantResults={instantResults}
          imageResults={imageResults}
          currentPage={currentPage}
          onPageChange={(page) => executeSearch(submittedQuery, activeTab, engineMode, page)}
          knowledgeGraph={knowledgeGraph}
          groundingSummary={groundingSummary}
          isGroundingLoading={isGroundingLoading}
          groundingError={groundingError}
          onRetryGrounding={() => {
            if (submittedQuery) {
              groundingCacheRef.current.delete(submittedQuery.toLowerCase());
              executeSearch(submittedQuery, activeTab, engineMode, 1);
            }
          }}
          mathResult={mathResult}
          bookmarks={bookmarks}
          onToggleBookmark={handleToggleBookmark}
          onOpenUrl={openInAppBrowser}
          driveFiles={driveFiles}
          isDriveLoading={isDriveLoading}
          driveError={driveError}
          hasDriveToken={Boolean(driveAccessToken)}
          onConnectDrive={handleGoogleSignIn}
          onSaveSummaryToDrive={handleSaveSummaryToDrive}
          renderAccountControl={renderAccountControl}
        />

        <ApiConfigModal
          isOpen={showApiModal}
          config={apiConfig}
          engineMode={engineMode}
          onChangeEngine={(mode) => {
            setEngineMode(mode);
            if (submittedQuery) {
              executeSearch(submittedQuery, activeTab, mode, 1);
            }
          }}
          onClose={() => setShowApiModal(false)}
          onSaveConfig={handleSaveApiConfig}
          onClearConfig={handleClearApiConfig}
        />

        <BookmarksDrawer
          isOpen={showBookmarksDrawer}
          bookmarks={bookmarks}
          onClose={() => setShowBookmarksDrawer(false)}
          onRemoveBookmark={handleRemoveBookmark}
          onOpenUrl={openInAppBrowser}
        />

        <ExtensionsModal
          isOpen={showExtensionsModal}
          extensions={extensions}
          onClose={() => setShowExtensionsModal(false)}
          onToggleInstall={handleToggleInstallExtension}
          onToggleEnable={handleToggleEnableExtension}
          onUpdateSettings={handleUpdateExtensionSettings}
          onAddCustomExtension={handleAddCustomExtension}
          onDeleteCustomExtension={handleDeleteCustomExtension}
        />

        <InAppBrowser
          url={browserTarget?.url || null}
          initialTitle={browserTarget?.title}
          isBookmarked={(u) => bookmarks.some((b) => b.url === u)}
          onToggleBookmark={handleToggleBookmark}
          extensions={extensions}
          onOpenExtensions={() => setShowExtensionsModal(true)}
          notes={extensionNotes}
          onAddNote={handleAddExtensionNote}
          onDeleteNote={handleDeleteExtensionNote}
          onClose={() => setBrowserTarget(null)}
        />
      </>
    );
  }

  // 3. Main NOVA Home Page (Google-identical RTL layout)
  const appShortcuts = [
    {
      label: 'بحث نوفا',
      icon: <Search className="w-5 h-5 text-[#4285F4]" />,
      action: () => setShowAppLauncher(false),
    },
    {
      label: 'الصور',
      icon: <ImageIcon className="w-5 h-5 text-[#EA4335]" />,
      action: () => {
        setActiveTab('images');
        setShowAppLauncher(false);
        if (searchInput.trim()) executeSearch(searchInput, 'images', engineMode, 1);
      },
    },
    {
      label: 'الأخبار',
      icon: <Newspaper className="w-5 h-5 text-[#34A853]" />,
      action: () => {
        setActiveTab('news');
        setShowAppLauncher(false);
        executeSearch(searchInput.trim() || 'أخبار العالم اليوم', 'news', engineMode, 1);
      },
    },
    {
      label: 'الفيديو',
      icon: <Video className="w-5 h-5 text-[#FBBC05]" />,
      action: () => {
        setActiveTab('videos');
        setShowAppLauncher(false);
        if (searchInput.trim()) executeSearch(searchInput, 'videos', engineMode, 1);
      },
    },
    {
      label: 'ملفات Drive',
      icon: <HardDrive className="w-5 h-5 text-[#4285F4]" />,
      action: () => {
        setActiveTab('drive');
        setShowAppLauncher(false);
        executeSearch(searchInput.trim() || 'مستند', 'drive', engineMode, 1);
      },
    },
    {
      label: 'الخرائط',
      icon: <MapPin className="w-5 h-5 text-[#34A853]" />,
      action: () => {
        setShowAppLauncher(false);
        openInAppBrowser('https://maps.google.com', 'خرائط Google');
      },
    },
    {
      label: 'الترجمة',
      icon: <Languages className="w-5 h-5 text-[#4285F4]" />,
      action: () => {
        setShowAppLauncher(false);
        openInAppBrowser('https://translate.google.com', 'ترجمة Google');
      },
    },
    {
      label: 'الآلة الحاسبة',
      icon: <Calculator className="w-5 h-5 text-[#EA4335]" />,
      action: () => {
        setShowAppLauncher(false);
        executeSearch('125 * 8 + 50', 'all', engineMode, 1);
      },
    },
    {
      label: 'المفضلة',
      icon: <Bookmark className="w-5 h-5 text-[#FBBC05]" />,
      action: () => {
        setShowAppLauncher(false);
        setShowBookmarksDrawer(true);
      },
    },
    {
      label: 'إعدادات المحرك',
      icon: <KeyRound className="w-5 h-5 text-[#5f6368] dark:text-[#bdc1c6]" />,
      action: () => {
        setShowAppLauncher(false);
        setShowApiModal(true);
      },
    },
    {
      label: 'الإضافات',
      icon: <Puzzle className="w-5 h-5 text-[#1a73e8]" />,
      action: () => {
        setShowAppLauncher(false);
        setShowExtensionsModal(true);
      },
    },
    {
      label: 'مشغّل سطح المكتب',
      icon: <Download className="w-5 h-5 text-[#34A853]" />,
      action: () => {
        setShowAppLauncher(false);
        setShowLauncherModal(true);
      },
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] flex flex-col justify-between">
      {/* Top Header Bar */}
      <header className="w-full px-5 sm:px-7 py-3.5 flex items-center justify-between gap-6">
        {/* Right side in RTL: Quick Text Links */}
        <nav className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-[#202124] dark:text-[#e8eaed]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('images');
              if (searchInput.trim()) executeSearch(searchInput, 'images', engineMode, 1);
            }}
            className={`hover:underline cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'images' ? 'text-[#1a73e8] dark:text-[#8ab4f8]' : ''
            }`}
          >
            صور نوفا
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('drive');
              executeSearch(searchInput.trim() || 'ملف', 'drive', engineMode, 1);
            }}
            className="hover:underline cursor-pointer whitespace-nowrap shrink-0 hidden sm:inline"
          >
            ملفات Drive
          </button>

          <button
            type="button"
            onClick={() => setShowExtensionsModal(true)}
            className="inline-flex items-center gap-1.5 hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            <Puzzle className="w-4 h-4 text-[#1a73e8] dark:text-[#8ab4f8]" />
            <span>الإضافات</span>
          </button>

          <button
            type="button"
            onClick={() => setShowApiModal(true)}
            className="hover:underline cursor-pointer whitespace-nowrap shrink-0 hidden md:inline"
          >
            إعدادات المحرك
          </button>

          <button
            type="button"
            onClick={() => setShowBookmarksDrawer(true)}
            className="hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            المفضلة
          </button>

          <button
            type="button"
            onClick={() => setShowLauncherModal(true)}
            className="inline-flex items-center gap-1.5 hover:underline cursor-pointer whitespace-nowrap shrink-0 text-[#1a73e8] dark:text-[#8ab4f8]"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل لسطح المكتب</span>
          </button>
        </nav>

        {/* Left side in RTL: Theme Toggle + 9-dot App Launcher + Avatar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            className="p-2 rounded-full text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* 9-dot App Launcher */}
          <div ref={launcherRef} className="relative">
            <button
              type="button"
              onClick={() => setShowAppLauncher((s) => !s)}
              title="تطبيقات نوفا"
              aria-label="تطبيقات نوفا"
              className="p-2 rounded-full text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>

            {showAppLauncher && (
              <div className="absolute left-0 top-12 z-50 w-72 bg-[#e9eef6] dark:bg-[#28292c] rounded-[24px] p-3 shadow-2xl border border-[#dadce0] dark:border-[#3c4043]">
                <div className="bg-white dark:bg-[#202124] rounded-2xl p-3 grid grid-cols-3 gap-2">
                  {appShortcuts.map((app) => (
                    <button
                      key={app.label}
                      type="button"
                      onClick={app.action}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl hover:bg-[#f1f6fe] dark:hover:bg-[#303134] transition-colors cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#f8f9fa] dark:bg-[#28292c] flex items-center justify-center">
                        {app.icon}
                      </div>
                      <span className="text-[11px] font-medium text-[#202124] dark:text-[#e8eaed] whitespace-nowrap">
                        {app.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {renderAccountControl()}
        </div>
      </header>

      {/* Home Main Grid: Recent Searches Sidebar + Centered Brand, Search Bar & Shortcuts */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-12 flex flex-col lg:grid lg:grid-cols-12 items-center gap-8">
        <div className="w-full max-w-[620px] lg:max-w-none lg:col-span-3 order-2 lg:order-1">
          <RecentSearchesSidebar
            history={history}
            isGuest={activeAccount.isGuest}
            onSelectSearch={handleSelectHistoryEntry}
            onClearHistory={handleClearHistory}
          />
        </div>

        <div className="w-full max-w-[620px] lg:max-w-none lg:col-span-6 order-1 lg:order-2 flex flex-col items-center">
          <div className="w-full max-w-[620px] flex flex-col items-center">
          {/* Logo & Tagline */}
          <div className="flex flex-col items-center text-center mb-7">
            <NovaLogo size="lg" />
            <p className="mt-3 text-sm text-[#5f6368] dark:text-[#9aa0a6]">
              محرك بحث ذكي يجمع بين Google و DuckDuckGo
            </p>
          </div>

          {/* Search Pill Bar */}
          <div className="w-full">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={(q) => executeSearch(q, activeTab, engineMode, 1)}
              history={history}
              autoFocus
            />
          </div>

          {/* Classic Two Search Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (searchInput.trim()) {
                  executeSearch(searchInput, activeTab, engineMode, 1);
                }
              }}
              className="px-6 py-2.5 rounded-lg bg-[#f8f9fa] dark:bg-[#303134] border border-[#f8f9fa] dark:border-[#303134] hover:border-[#dadce0] dark:hover:border-[#5f6368] hover:shadow-xs text-sm font-medium text-[#3c4043] dark:text-[#e8eaed] transition-all cursor-pointer whitespace-nowrap"
            >
              بحث NOVA
            </button>

            <button
              type="button"
              onClick={handleLuckySearch}
              className="px-6 py-2.5 rounded-lg bg-[#f8f9fa] dark:bg-[#303134] border border-[#f8f9fa] dark:border-[#303134] hover:border-[#dadce0] dark:hover:border-[#5f6368] hover:shadow-xs text-sm font-medium text-[#3c4043] dark:text-[#e8eaed] transition-all cursor-pointer whitespace-nowrap"
            >
              ضربة حظ
            </button>
          </div>

          {/* Segmented Search Engine Mode Selector */}
          <div
            className="mt-5 inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-[#f1f3f4] dark:bg-[#303134] border border-[#e8eaed] dark:border-[#3c4043]"
            role="group"
            aria-label="اختيار وضع محرك البحث"
          >
            {(
              [
                { id: 'hybrid', label: 'الوضع المدمج (Google + DuckDuckGo)' },
                { id: 'google', label: 'Google الذكي' },
                { id: 'duckduckgo', label: 'DuckDuckGo فقط' },
              ] as { id: EngineMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEngineMode(opt.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  engineMode === opt.id
                    ? 'bg-white dark:bg-[#202124] text-[#1a73e8] dark:text-[#8ab4f8] shadow-xs'
                    : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Up to 6 Customizable Circular Quick Shortcut Tiles */}
          <div className="mt-8 w-full max-w-[540px] flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {shortcuts.slice(0, 6).map((sc) => (
              <div key={sc.id} className="group relative flex flex-col items-center w-20">
                <a
                  href={isSafeHttpUrl(sc.url) ? sc.url : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (isSafeHttpUrl(sc.url) && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      openInAppBrowser(sc.url, sc.title);
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors w-full"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-xs"
                    style={{ backgroundColor: sc.iconColor }}
                  >
                    {sc.title.charAt(0)}
                  </div>
                  <span className="text-xs text-[#202124] dark:text-[#e8eaed] truncate max-w-full">
                    {sc.title}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => handleRemoveShortcut(sc)}
                  aria-label={`حذف اختصار ${sc.title}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-1 left-1 p-1 rounded-full bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#5f6368] text-[#5f6368] hover:text-[#d93025] transition-opacity cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {shortcuts.length < 6 && (
              <button
                type="button"
                onClick={() => setShowShortcutModal(true)}
                className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors w-20 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#f1f3f4] dark:bg-[#303134] text-[#202124] dark:text-[#e8eaed] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs text-[#202124] dark:text-[#e8eaed] whitespace-nowrap">
                  إضافة اختصار
                </span>
              </button>
            )}
          </div>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-3 lg:order-3" aria-hidden="true" />
      </main>

      {/* Clean Minimal Footer */}
      <footer className="w-full bg-[#f2f2f2] dark:bg-[#171717] border-t border-[#e4e4e4] dark:border-[#3c4043] px-6 py-3.5 text-xs text-[#70757a] dark:text-[#9aa0a6] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-medium text-[#202124] dark:text-[#e8eaed]">NOVA | نوفا</span>
          <span aria-hidden="true">·</span>
          <span>محرك بحث عربي ذكي</span>
        </div>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setShowApiModal(true)}
            className="hover:underline cursor-pointer"
          >
            إعدادات المحرك
          </button>
          <button
            type="button"
            onClick={() => setShowLauncherModal(true)}
            className="inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تنزيل مشغّل Windows (.bat)</span>
          </button>
          <button
            type="button"
            onClick={() => setView('chooser')}
            className="hover:underline cursor-pointer"
          >
            إدارة الحسابات
          </button>
          <a
            href="https://duckduckgo.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                openInAppBrowser('https://duckduckgo.com/privacy', 'سياسة الخصوصية');
              }
            }}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>الخصوصية</span>
          </a>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ApiConfigModal
        isOpen={showApiModal}
        config={apiConfig}
        engineMode={engineMode}
        onChangeEngine={(mode) => setEngineMode(mode)}
        onClose={() => setShowApiModal(false)}
        onSaveConfig={handleSaveApiConfig}
        onClearConfig={handleClearApiConfig}
      />

      <BookmarksDrawer
        isOpen={showBookmarksDrawer}
        bookmarks={bookmarks}
        onClose={() => setShowBookmarksDrawer(false)}
        onRemoveBookmark={handleRemoveBookmark}
        onOpenUrl={openInAppBrowser}
      />

      <ShortcutModal
        isOpen={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
        onAdd={handleAddShortcut}
      />

      <ExtensionsModal
        isOpen={showExtensionsModal}
        extensions={extensions}
        onClose={() => setShowExtensionsModal(false)}
        onToggleInstall={handleToggleInstallExtension}
        onToggleEnable={handleToggleEnableExtension}
        onUpdateSettings={handleUpdateExtensionSettings}
        onAddCustomExtension={handleAddCustomExtension}
        onDeleteCustomExtension={handleDeleteCustomExtension}
      />

      <DesktopLauncherModal
        isOpen={showLauncherModal}
        onClose={() => setShowLauncherModal(false)}
      />

      <InAppBrowser
        url={browserTarget?.url || null}
        initialTitle={browserTarget?.title}
        isBookmarked={(u) => bookmarks.some((b) => b.url === u)}
        onToggleBookmark={handleToggleBookmark}
        extensions={extensions}
        onOpenExtensions={() => setShowExtensionsModal(true)}
        notes={extensionNotes}
        onAddNote={handleAddExtensionNote}
        onDeleteNote={handleDeleteExtensionNote}
        onClose={() => setBrowserTarget(null)}
      />
    </div>
  );
}
