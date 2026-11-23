import { NovaExtension, SearchTab } from '../types';
import { isSafeHttpUrl } from './searchHelpers';

export const DEFAULT_EXTENSIONS_CATALOG: NovaExtension[] = [
  {
    id: 'quick_bangs',
    name: 'اختصارات البحث السريعة (!Bangs)',
    description:
      'انتقل مباشرة باستخدام أوامر مثل !w لويكيبيديا، !yt للفيديو، !img للصور، !n للأخبار، و!d لملفات Drive.',
    category: 'البحث',
    version: '1.2',
    author: 'فريق نوفا',
    iconColor: '#1A73E8',
    installed: true,
    enabled: true,
  },
  {
    id: 'ad_clutter_blocker',
    name: 'منقي القراءة ومانع التشتيت',
    description:
      'ينظف صفحات وضع القراءة داخل المتصفح المدمج من العبارات الترويجية، إشعارات ملفات الارتباط، والروابط المشتتة.',
    category: 'القراءة',
    version: '2.0',
    author: 'فريق نوفا',
    iconColor: '#34A853',
    installed: true,
    enabled: true,
  },
  {
    id: 'instant_translator',
    name: 'مترجم الصفحات الفوري',
    description:
      'يضيف زر ترجمة فوري داخل شريط المتصفح المدمج لترجمة أي صفحة أجنبية إلى العربية بضغطة واحدة.',
    category: 'الإنتاجية',
    version: '1.4',
    author: 'فريق نوفا',
    iconColor: '#4285F4',
    installed: true,
    enabled: true,
  },
  {
    id: 'smart_calculator',
    name: 'الآلة الحاسبة الفورية',
    description:
      'يعرض بطاقة حاسبة تفاعلية مباشرة أعلى نتائج البحث عند كتابة أي عملية حسابية.',
    category: 'البحث',
    version: '1.1',
    author: 'فريق نوفا',
    iconColor: '#FBBC05',
    installed: true,
    enabled: true,
  },
  {
    id: 'eye_comfort_reader',
    name: 'القارئ المريح للعين',
    description:
      'يتيح اختيار خلفية ورقية دافئة أو ليلية مريحة والتحكم في حجم خط القراءة داخل المتصفح المدمج.',
    category: 'القراءة',
    version: '1.5',
    author: 'فريق نوفا',
    iconColor: '#8E24AA',
    installed: false,
    enabled: false,
    settings: {
      readerFontSize: 'large',
      readerTheme: 'sepia',
    },
  },
  {
    id: 'page_notes',
    name: 'دفتر ملاحظات المواقع',
    description:
      'يضيف لوحة ملاحظات سريعة داخل المتصفح المدمج لحفظ أفكارك واقتباساتك مرتبطة برابط كل موقع.',
    category: 'الإنتاجية',
    version: '1.0',
    author: 'فريق نوفا',
    iconColor: '#EA4335',
    installed: false,
    enabled: false,
  },
];

export function mergeWithDefaultCatalog(saved: NovaExtension[]): NovaExtension[] {
  const byId = new Map(saved.map((e) => [e.id, e]));
  const mergedDefaults = DEFAULT_EXTENSIONS_CATALOG.map((def) => {
    const existing = byId.get(def.id);
    if (!existing) return def;
    return {
      ...def,
      installed: existing.installed,
      enabled: existing.enabled,
      settings: existing.settings ? { ...def.settings, ...existing.settings } : def.settings,
    };
  });
  const customOnly = saved.filter((e) => e.isCustom);
  return [...mergedDefaults, ...customOnly];
}

export function isExtensionActive(extensions: NovaExtension[], id: string): boolean {
  const ext = extensions.find((e) => e.id === id);
  return Boolean(ext && ext.installed && ext.enabled);
}

export type BangResolution =
  | { type: 'tab'; tab: SearchTab; cleanQuery: string }
  | { type: 'open_url'; url: string; title: string }
  | null;

export function resolveSearchBang(
  rawQuery: string,
  extensions: NovaExtension[]
): BangResolution {
  const trimmed = rawQuery.trim();
  const match = trimmed.match(/^(![a-zA-Z0-9_-]{1,15})\s+(.+)$/);
  if (!match) return null;

  const trigger = match[1].toLowerCase();
  const cleanQuery = match[2].trim();
  if (!cleanQuery) return null;

  // Check custom bang extensions first
  const customMatch = extensions.find(
    (e) =>
      e.isCustom &&
      e.installed &&
      e.enabled &&
      e.customRule?.trigger.toLowerCase() === trigger
  );
  if (customMatch?.customRule?.targetUrlTemplate) {
    const targetUrl = customMatch.customRule.targetUrlTemplate.replace(
      /\{q\}/g,
      encodeURIComponent(cleanQuery)
    );
    if (isSafeHttpUrl(targetUrl)) {
      return {
        type: 'open_url',
        url: targetUrl,
        title: `${customMatch.name}: ${cleanQuery}`,
      };
    }
  }

  // Built-in quick bangs
  if (isExtensionActive(extensions, 'quick_bangs')) {
    if (trigger === '!yt' || trigger === '!vid') {
      return { type: 'tab', tab: 'videos', cleanQuery };
    }
    if (trigger === '!img' || trigger === '!i') {
      return { type: 'tab', tab: 'images', cleanQuery };
    }
    if (trigger === '!n' || trigger === '!news') {
      return { type: 'tab', tab: 'news', cleanQuery };
    }
    if (trigger === '!d' || trigger === '!drive') {
      return { type: 'tab', tab: 'drive', cleanQuery };
    }
    if (trigger === '!w' || trigger === '!wiki') {
      const lang = /[\u0600-\u06FF]/.test(cleanQuery) ? 'ar' : 'en';
      return {
        type: 'open_url',
        url: `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(cleanQuery)}`,
        title: `ويكيبيديا: ${cleanQuery}`,
      };
    }
  }

  return null;
}

const CLUTTER_PATTERNS = [
  /accept\s+(all\s+)?cookies/i,
  /cookie\s+policy/i,
  /privacy\s+preferences/i,
  /subscribe\s+to\s+our\s+newsletter/i,
  /ملفات\s+تعريف\s+الارتباط/,
  /اشترك\s+في\s+النشرة/,
  /جميع\s+الحقوق\s+محفوظة/,
  /advertisement|sponsored\s+content/i,
];

export function filterClutterBlock(text: string): boolean {
  return CLUTTER_PATTERNS.some((re) => re.test(text));
}
