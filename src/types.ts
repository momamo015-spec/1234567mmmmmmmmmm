export type ThemeMode = 'light' | 'dark';
export type EngineMode = 'hybrid' | 'google' | 'duckduckgo';
export type SearchTab = 'all' | 'images' | 'videos' | 'news' | 'drive';

export interface NovaAccount {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  photoURL?: string;
  isGuest?: boolean;
  isGoogleAccount?: boolean;
  statusLabel: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  engineMode: EngineMode;
  tab: SearchTab;
  createdAt: number;
}

export interface BookmarkEntry {
  id: string;
  title: string;
  url: string;
  snippet: string;
  displayLink: string;
  sourceType: 'google' | 'duckduckgo' | 'wiki' | 'drive' | 'ai';
  createdAt: number;
}

export interface ShortcutEntry {
  id: string;
  dbId?: number;
  title: string;
  url: string;
  iconColor: string;
}

export interface GoogleApiConfig {
  apiKey: string;
  preferredLang?: 'auto' | 'ar' | 'en';
}

export interface SearchResultItem {
  id: string;
  title: string;
  url: string;
  displayLink: string;
  snippet: string;
  favicon?: string;
  source: 'google' | 'duckduckgo' | 'wiki';
  image?: {
    contextLink?: string;
    width?: number;
    height?: number;
    thumbnailLink?: string;
  };
  datePublished?: string;
}

export interface KnowledgeGraphData {
  title: string;
  description?: string;
  abstractText: string;
  abstractSource?: string;
  abstractUrl?: string;
  imageUrl?: string;
  relatedTopics: { text: string; url: string }[];
  infobox?: { label: string; value: string }[];
}

export interface GroundingSummary {
  summary: string;
  sources: { uri: string; title: string }[];
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
}

export interface NovaExtension {
  id: string;
  name: string;
  description: string;
  category: 'القراءة' | 'البحث' | 'الإنتاجية' | 'مخصصة';
  version: string;
  author: string;
  iconColor: string;
  installed: boolean;
  enabled: boolean;
  isCustom?: boolean;
  customRule?: {
    trigger: string;
    targetUrlTemplate: string;
  };
  settings?: {
    readerFontSize?: 'normal' | 'large' | 'xlarge';
    readerTheme?: 'auto' | 'sepia' | 'night';
  };
}

export interface ExtensionNoteEntry {
  id: string;
  url: string;
  pageTitle: string;
  content: string;
  createdAt: number;
}

