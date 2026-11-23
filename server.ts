import 'dotenv/config';
import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  addBookmarkEntry,
  addHistoryEntry,
  addShortcutEntry,
  clearUserHistory,
  getOrCreateUser,
  getUserBookmarks,
  getUserHistory,
  getUserShortcuts,
  removeBookmarkEntry,
  removeShortcutEntry,
  updateUserPreferences,
} from './src/db/users.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح GEMINI_API_KEY غير مُعدّ في متغيرات البيئة على الخادم.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const groundingCache = new Map<
  string,
  { summary: string; sources: { uri: string; title: string }[]; expiresAt: number }
>();
const GROUNDING_TTL_MS = 10 * 60 * 1000;

function parseGeminiError(error: unknown, fallbackMessage: string): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error || '');
  const statusMatch = (error as { status?: number })?.status;

  if (statusMatch === 429 || raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'تم تجاوز الحد المؤقت لطلبات الذكاء الاصطناعي حالياً (429). يرجى المحاولة بعد قليل أو استخدام مفتاح API مفعّل للفوترة من لوحة Settings > Secrets.',
    };
  }
  if (statusMatch === 403 || raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message:
        'تعذر التحقق من صلاحية مفتاح Gemini API. يرجى التحقق من المفتاح في لوحة Settings > Secrets.',
    };
  }
  if (statusMatch === 400 || raw.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message:
        'مفتاح Gemini API غير صالح. يرجى مراجعته في لوحة Settings > Secrets.',
    };
  }
  return {
    status: 500,
    message: raw || fallbackMessage,
  };
}

// Gemini Search Grounding with gemini-4-hydrogen + googleSearch
app.post('/api/gemini/search-grounding', async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query || query.length > 500) {
      return res.status(400).json({ error: 'يرجى إدخال عبارة بحث صالحة (بحد أقصى 500 حرف).' });
    }

    const cacheKey = query.toLowerCase();
    const cached = groundingCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ summary: cached.summary, sources: cached.sources });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `أجب عن استعلام البحث التالي باللغة العربية الواضحة والموجزة والمنظمة في فقرة أو نقاط قصيرة دقيقة ومحدّثة، مع التركيز على الحقائق الموثقة:\n\n${query}`,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction:
          'أنت مساعد بحث ذكي داخل محرك بحث نوفا (NOVA). قدّم إجابة عربية موجزة، دقيقة، ومباشرة بناءً على نتائج البحث الحية.',
      },
    });

    const summary = response.text?.trim() || '';
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: { uri: string; title: string }[] = [];
    const seen = new Set<string>();

    for (const chunk of rawChunks) {
      const uri = chunk?.web?.uri;
      const title = chunk?.web?.title || uri;
      if (uri && typeof uri === 'string' && /^https?:\/\//i.test(uri) && !seen.has(uri)) {
        seen.add(uri);
        sources.push({ uri, title: String(title || uri) });
      }
    }

    if (summary) {
      if (groundingCache.size >= 200) {
        const oldestKey = groundingCache.keys().next().value;
        if (oldestKey) groundingCache.delete(oldestKey);
      }
      groundingCache.set(cacheKey, {
        summary,
        sources,
        expiresAt: Date.now() + GROUNDING_TTL_MS,
      });
    }

    return res.json({ summary, sources });
  } catch (error: unknown) {
    const parsed = parseGeminiError(error, 'تعذر جلب الملخص الذكي من الخادم.');
    if (parsed.status === 429) {
      console.warn('Gemini search-grounding rate limit reached (429).');
    } else {
      console.error('Gemini search-grounding error:', error);
    }
    return res.status(parsed.status).json({ error: parsed.message });
  }
});

// Gemini TTS with gemini-3.8-flash-tts
app.post('/api/gemini/tts', async (req, res) => {
  try {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const voiceName = typeof req.body?.voiceName === 'string' ? req.body.voiceName : 'Kore';
    const allowedVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
    const selectedVoice = allowedVoices.includes(voiceName) ? voiceName : 'Kore';

    if (!rawText) {
      return res.status(400).json({ error: 'النص المطلوب تحويله إلى صوت فارغ.' });
    }

    const text = rawText.slice(0, 1500);
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: 'Clear, calm, natural Arabic and English search narrator',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({ error: 'لم يُرجع نموذج الصوت بيانات صوتية صالحة.' });
    }

    return res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
  } catch (error: unknown) {
    const parsed = parseGeminiError(error, 'تعذر تحويل النص إلى صوت.');
    if (parsed.status === 429) {
      console.warn('Gemini TTS rate limit reached (429).');
    } else {
      console.error('Gemini TTS error:', error);
    }
    return res.status(parsed.status).json({ error: parsed.message });
  }
});

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function unwrapDdgUrl(rawHref: string): string {
  try {
    if (rawHref.startsWith('//')) {
      rawHref = `https:${rawHref}`;
    }
    const u = new URL(rawHref);
    if (u.hostname.includes('duckduckgo.com') && u.searchParams.has('uddg')) {
      const target = u.searchParams.get('uddg') || '';
      if (/^https?:\/\//i.test(target)) return target;
    }
    if (/^https?:\/\//i.test(rawHref)) return rawHref;
  } catch {
    // Ignore malformed url
  }
  return '';
}

async function fetchDdgHtmlResults(query: string): Promise<
  { title: string; url: string; snippet: string; displayLink: string }[]
> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
      }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const results: { title: string; url: string; snippet: string; displayLink: string }[] = [];

    // Parse result__a links and result__snippet blocks
    const blockRegex =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;

    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(html)) !== null && results.length < 15) {
      const targetUrl = unwrapDdgUrl(match[1]);
      if (!targetUrl) continue;
      const title = decodeHtmlEntities(match[2]);
      const snippet = decodeHtmlEntities(match[3]);
      let displayLink = '';
      try {
        displayLink = new URL(targetUrl).hostname;
      } catch {
        displayLink = targetUrl;
      }
      if (title && targetUrl) {
        results.push({ title, url: targetUrl, snippet, displayLink });
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchGoogleNewsRss(query: string, lang: 'ar' | 'en'): Promise<
  { title: string; url: string; snippet: string; displayLink: string; datePublished?: string }[]
> {
  try {
    const hl = lang === 'ar' ? 'ar' : 'en-US';
    const gl = lang === 'ar' ? 'SA' : 'US';
    const ceid = lang === 'ar' ? 'SA:ar' : 'US:en';
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query
    )}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
    const res = await fetch(rssUrl, { headers: { 'User-Agent': 'NOVA-Search/1.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: {
      title: string;
      url: string;
      snippet: string;
      displayLink: string;
      datePublished?: string;
    }[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) !== null && items.length < 15) {
      const block = m[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);

      const rawLink = linkMatch ? linkMatch[1].trim() : '';
      const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
      const sourceName = sourceMatch ? decodeHtmlEntities(sourceMatch[1]) : 'أخبار Google';
      const pubDate = pubMatch ? pubMatch[1].trim() : undefined;

      if (rawTitle && /^https?:\/\//i.test(rawLink)) {
        items.push({
          title: rawTitle,
          url: rawLink,
          snippet: pubDate
            ? `${sourceName} · ${new Date(pubDate).toLocaleDateString('ar-EG')}`
            : sourceName,
          displayLink: sourceName,
          datePublished: pubDate,
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchImageResults(query: string, lang: 'ar' | 'en') {
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=18&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=600&format=json`;
    const wikiImgUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=12&prop=pageimages|info&inprop=url&pithumbsize=600&format=json`;

    const [commonsRes, wikiRes] = await Promise.all([
      fetch(commonsUrl, { headers: { 'User-Agent': 'NOVA-Search/1.0' } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(wikiImgUrl, { headers: { 'User-Agent': 'NOVA-Search/1.0' } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const images: {
      title: string;
      url: string;
      displayLink: string;
      contextLink: string;
      thumbnailLink: string;
      width?: number;
      height?: number;
    }[] = [];

    const wikiPages = wikiRes?.query?.pages ? Object.values(wikiRes.query.pages) : [];
    for (const p of wikiPages as Array<{
      title?: string;
      fullurl?: string;
      thumbnail?: { source?: string; width?: number; height?: number };
    }>) {
      if (p.thumbnail?.source) {
        images.push({
          title: p.title || query,
          url: p.thumbnail.source,
          displayLink: `${lang}.wikipedia.org`,
          contextLink: p.fullurl || p.thumbnail.source,
          thumbnailLink: p.thumbnail.source,
          width: p.thumbnail.width,
          height: p.thumbnail.height,
        });
      }
    }

    const commonsPages = commonsRes?.query?.pages ? Object.values(commonsRes.query.pages) : [];
    for (const p of commonsPages as Array<{
      title?: string;
      imageinfo?: Array<{
        url?: string;
        thumburl?: string;
        descriptionurl?: string;
        width?: number;
        height?: number;
        mime?: string;
      }>;
    }>) {
      const info = p.imageinfo?.[0];
      if (!info?.url) continue;
      if (info.mime && !info.mime.startsWith('image/')) continue;
      if (info.mime === 'image/svg+xml') continue;
      const cleanTitle = (p.title || query).replace(/^File:/i, '').replace(/\.[^.]+$/, '');
      images.push({
        title: cleanTitle,
        url: info.url,
        displayLink: 'commons.wikimedia.org',
        contextLink: info.descriptionurl || info.url,
        thumbnailLink: info.thumburl || info.url,
        width: info.width,
        height: info.height,
      });
    }

    return images;
  } catch {
    return [];
  }
}

// Multi-Engine Web, News, Image & Knowledge Graph Search (No Search Engine ID / cx required)
app.get('/api/search/instant', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 300) : '';
  const tab = typeof req.query.tab === 'string' ? req.query.tab : 'all';
  const langParam = typeof req.query.lang === 'string' ? req.query.lang : 'auto';
  if (!q) {
    return res.status(400).json({ error: 'استعلام البحث مطلوب.' });
  }

  const encoded = encodeURIComponent(q);
  const isArabic = langParam === 'ar' || (langParam === 'auto' && /[\u0600-\u06FF]/.test(q));
  const primaryLang = isArabic ? 'ar' : 'en';

  if (tab === 'images') {
    const images = await fetchImageResults(q, primaryLang);
    return res.json({ images, ddg: null, wikiSummary: null, wikiResults: [], webResults: [] });
  }

  const ddgJsonPromise = fetch(
    `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
    { headers: { 'User-Agent': 'NOVA-Search/1.0' } }
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const webQuery = tab === 'videos' ? `${q} site:youtube.com OR فيديو` : q;
  const webPromise =
    tab === 'news'
      ? fetchGoogleNewsRss(q, primaryLang)
      : fetchDdgHtmlResults(webQuery);

  const wikiSearchPromise = fetch(
    `https://${primaryLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json&srlimit=6`,
    { headers: { 'User-Agent': 'NOVA-Search/1.0' } }
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const wikiOpensearchPromise = fetch(
    `https://${primaryLang}.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=5&namespace=0&format=json`,
    { headers: { 'User-Agent': 'NOVA-Search/1.0' } }
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const [ddgData, webResults, wikiSearchData, wikiOpenSearch] = await Promise.all([
    ddgJsonPromise,
    webPromise,
    wikiSearchPromise,
    wikiOpensearchPromise,
  ]);

  let wikiSummary: {
    title: string;
    extract: string;
    thumbnail?: string;
    url: string;
    description?: string;
  } | null = null;

  const firstTitle =
    wikiOpenSearch && Array.isArray(wikiOpenSearch[1]) && wikiOpenSearch[1][0]
      ? String(wikiOpenSearch[1][0])
      : wikiSearchData?.query?.search?.[0]?.title;

  if (firstTitle) {
    try {
      const sumRes = await fetch(
        `https://${primaryLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`,
        { headers: { 'User-Agent': 'NOVA-Search/1.0' } }
      );
      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        wikiSummary = {
          title: sumJson.title || firstTitle,
          extract: sumJson.extract || '',
          thumbnail: sumJson.thumbnail?.source,
          url:
            sumJson.content_urls?.desktop?.page ||
            `https://${primaryLang}.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`,
          description: sumJson.description || '',
        };
      }
    } catch {
      // Optional summary enrichment
    }
  }

  return res.json({
    ddg: ddgData,
    webResults,
    wikiSummary,
    wikiResults: Array.isArray(wikiSearchData?.query?.search)
      ? wikiSearchData.query.search.map((item: { title: string; snippet: string; pageid: number }) => ({
          title: item.title,
          snippet: String(item.snippet || '').replace(/<[^>]+>/g, ''),
          url: `https://${primaryLang}.wikipedia.org/?curid=${item.pageid}`,
          displayLink: `${primaryLang}.wikipedia.org`,
        }))
      : [],
  });
});

function isPrivateOrReservedIp(ip: string): boolean {
  let target = ip.trim().toLowerCase();
  if (target.startsWith('::ffff:')) {
    const mapped = target.slice(7);
    if (net.isIPv4(mapped)) {
      target = mapped;
    } else {
      return true;
    }
  }

  if (net.isIPv4(target)) {
    const parts = target.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0) return true; // 192.0.0.0/24, 192.0.2.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return true; // 198.18.0.0/15, 198.51.100.0/24
    if (a === 203 && b === 0) return true; // 203.0.113.0/24
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (net.isIPv6(target)) {
    if (target === '::' || target === '::1') return true;
    if (/^(0+:)+0*[01]$/.test(target)) return true;
    if (/^fe[89ab][0-9a-f]:/i.test(target) || target.startsWith('fe80')) return true; // Link-local
    if (target.startsWith('fc') || target.startsWith('fd')) return true; // Unique local fc00::/7
    if (target.startsWith('ff')) return true; // Multicast
    return false;
  }

  return true;
}

async function validatePublicHttpUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('بروتوكول الرابط غير مدعوم.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('الروابط التي تحتوي على بيانات اعتماد غير مسموح بها.');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('المنفذ غير مدعوم للمعاينة المباشرة.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('الوصول إلى العناوين المحلية محظور.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('العنوان المستهدف ضمن نطاق شبكة خاصة محظورة.');
    }
    return parsed;
  }

  const resolved = await dns.lookup(host, { all: true });
  if (!resolved.length) {
    throw new Error('تعذر العثور على خادم الموقع.');
  }
  for (const record of resolved) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error('العنوان المستهدف ضمن نطاق شبكة خاصة محظورة.');
    }
  }
  return parsed;
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r1 = new RegExp(
    `<meta[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  const r2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${escaped}["'][^>]*>`,
    'i'
  );
  const m = html.match(r1) || html.match(r2);
  return m ? decodeHtmlEntities(m[1]) : '';
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function fetchPublicResponseSafe(rawUrl: string): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = await validatePublicHttpUrl(rawUrl);
  let response: Response | null = null;

  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    try {
      response = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'Accept-Language': 'ar,en;q=0.8',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      const nextUrl = new URL(location, currentUrl);
      currentUrl = await validatePublicHttpUrl(nextUrl.toString());
      continue;
    }
    break;
  }

  if (!response) {
    throw new Error('تعذر الاتصال بالموقع المطلوب.');
  }
  return { response, finalUrl: currentUrl };
}

async function readResponseCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        chunks.push(value);
        if (totalBytes >= maxBytes) {
          await reader.cancel();
          break;
        }
      }
    }
  }
  return Buffer.concat(chunks);
}

function sanitizeAndRewriteHtml(rawHtml: string, finalUrl: string, nonce: string): string {
  // Strip remote scripts, nested active objects, meta CSP/refresh, and existing <base>
  let html = rawHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<applet\b[^>]*>[\s\S]*?<\/applet>/gi, '')
    .replace(/<base\b[^>]*\/?>/gi, '')
    .replace(
      /<meta\b[^>]*http-equiv\s*=\s*["']?\s*(?:content-security-policy|refresh|x-frame-options)\s*["']?[^>]*>/gi,
      ''
    )
    .replace(/<\/?noscript\b[^>]*>/gi, '')
    .replace(/\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:crossorigin|integrity)\s*(?:=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
    .replace(
      /\s(href|src|action|formaction)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html)[\s\S]*?\2/gi,
      ' $1="#"'
    );

  const headInject = `<base href="${escapeHtmlAttr(finalUrl)}" target="_self"><meta name="referrer" content="no-referrer">`;
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (match) => `${match}\n${headInject}`);
  } else if (/<html\b[^>]*>/i.test(html)) {
    html = html.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${headInject}</head>`);
  } else {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8">${headInject}</head><body>${html}</body></html>`;
  }

  const navBridge = `<script nonce="${nonce}">
(function(){
  document.addEventListener('click', function(e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!el) return;
    var raw = el.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#') {
      if (raw.length > 1) {
        e.preventDefault();
        var targetEl = document.getElementById(raw.slice(1));
        if (targetEl && targetEl.scrollIntoView) targetEl.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    try {
      var resolved = new URL(raw, document.baseURI);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        e.preventDefault();
        window.parent.postMessage({
          type: 'nova-browser-navigate',
          url: resolved.toString(),
          title: (el.textContent || '').trim().slice(0, 120)
        }, '*');
      }
    } catch (err) {}
  }, true);
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return;
    var method = (form.getAttribute('method') || 'get').toLowerCase();
    if (method !== 'get') return;
    try {
      var actionUrl = new URL(form.getAttribute('action') || document.baseURI, document.baseURI);
      if (actionUrl.protocol !== 'http:' && actionUrl.protocol !== 'https:') return;
      var fd = new FormData(form);
      fd.forEach(function(val, key) {
        if (typeof val === 'string') actionUrl.searchParams.set(key, val);
      });
      e.preventDefault();
      window.parent.postMessage({
        type: 'nova-browser-navigate',
        url: actionUrl.toString()
      }, '*');
    } catch (err) {}
  }, true);
})();
</script>`;

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${navBridge}\n</body>`);
  } else {
    html += `\n${navBridge}`;
  }

  return html;
}

// Safe In-App Browser Preview & Embed-Header Inspection (SSRF-Hardened)
app.get('/api/browser/preview', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl || rawUrl.length > 2000) {
    return res.status(400).json({ error: 'رابط غير صالح.' });
  }

  try {
    const { response, finalUrl: currentUrl } = await fetchPublicResponseSafe(rawUrl);

    const xFrame = (response.headers.get('x-frame-options') || '').trim().toLowerCase();
    const csp = (response.headers.get('content-security-policy') || '').toLowerCase();
    const frameAncestorsMatch = csp.match(/frame-ancestors\s+([^;]+)/i);
    const frameAncestors = frameAncestorsMatch ? frameAncestorsMatch[1].trim() : '';
    const embedBlocked =
      (Boolean(xFrame) && xFrame !== 'allowall') ||
      (Boolean(frameAncestors) && !frameAncestors.includes('*'));

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const finalUrl = currentUrl.toString();

    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return res.json({
        url: finalUrl,
        title: currentUrl.hostname,
        siteName: currentUrl.hostname,
        description: '',
        embedBlocked,
        contentType,
        blocks: [],
        links: [],
      });
    }

    // Read up to 1MB safely
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const maxBytes = 1024 * 1024;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          chunks.push(value);
          if (totalBytes >= maxBytes) {
            await reader.cancel();
            break;
          }
        }
      }
    }
    const html = Buffer.concat(chunks).toString('utf-8');

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogTitle = extractMetaContent(html, 'property', 'og:title');
    const title = ogTitle || (titleMatch ? decodeHtmlEntities(titleMatch[1]) : '') || currentUrl.hostname;
    const description =
      extractMetaContent(html, 'property', 'og:description') ||
      extractMetaContent(html, 'name', 'description');
    const siteName = extractMetaContent(html, 'property', 'og:site_name') || currentUrl.hostname;
    const rawOgImage = extractMetaContent(html, 'property', 'og:image');
    let heroImage = '';
    if (rawOgImage) {
      try {
        const resolvedImg = new URL(rawOgImage, finalUrl);
        if (resolvedImg.protocol === 'http:' || resolvedImg.protocol === 'https:') {
          heroImage = resolvedImg.toString();
        }
      } catch {
        // ignore invalid image url
      }
    }

    // Strip scripts, styles, SVGs, nav, footer before block extraction
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

    const blocks: { type: 'h1' | 'h2' | 'h3' | 'p' | 'li'; text: string }[] = [];
    const seenText = new Set<string>();
    const blockRegex = /<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let bm: RegExpExecArray | null;
    while ((bm = blockRegex.exec(cleanedHtml)) !== null && blocks.length < 70) {
      const tag = bm[1].toLowerCase() as 'h1' | 'h2' | 'h3' | 'p' | 'li';
      const text = decodeHtmlEntities(bm[2]).replace(/\s+/g, ' ').trim();
      if (text.length < (tag === 'p' ? 25 : 4)) continue;
      if (seenText.has(text)) continue;
      seenText.add(text);
      blocks.push({ type: tag, text });
    }

    const links: { text: string; url: string }[] = [];
    const seenLinks = new Set<string>([finalUrl]);
    const linkRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRegex.exec(cleanedHtml)) !== null && links.length < 24) {
      try {
        const resolvedLink = new URL(lm[1].trim(), finalUrl);
        if (resolvedLink.protocol !== 'http:' && resolvedLink.protocol !== 'https:') continue;
        const href = resolvedLink.toString();
        const label = decodeHtmlEntities(lm[2]).replace(/\s+/g, ' ').trim();
        if (!label || label.length < 3 || label.length > 110 || seenLinks.has(href)) continue;
        seenLinks.add(href);
        links.push({ text: label, url: href });
      } catch {
        // skip malformed link
      }
    }

    return res.json({
      url: finalUrl,
      title,
      siteName,
      description,
      heroImage,
      embedBlocked,
      contentType,
      blocks,
      links,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'انتهت مهلة الاتصال بالموقع.'
        : error instanceof Error
          ? error.message
          : 'تعذر تحميل معاينة الموقع.';
    return res.status(400).json({ error: message });
  }
});

// Sandboxed Full-Page Proxy Renderer for In-App Browser (SSRF-Hardened + Strict CSP + Opaque Origin)
app.get('/api/browser/render', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl || rawUrl.length > 2000) {
    return res.status(400).send('رابط غير صالح.');
  }

  try {
    const { response, finalUrl } = await fetchPublicResponseSafe(rawUrl);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const finalUrlStr = finalUrl.toString();
    const nonce = crypto.randomBytes(16).toString('base64');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; media-src * data: blob:; script-src 'nonce-${nonce}';`
    );

    if (contentType.startsWith('image/')) {
      return res.status(200).send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111;"><img src="${escapeHtmlAttr(finalUrlStr)}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body></html>`
      );
    }

    if (contentType.includes('text/plain')) {
      const buf = await readResponseCapped(response, 1024 * 1024);
      const escaped = escapeHtmlAttr(buf.toString('utf-8'));
      return res
        .status(200)
        .type('text/html; charset=utf-8')
        .send(
          `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:24px;font-family:monospace;line-height:1.6;white-space:pre-wrap;">${escaped}</body></html>`
        );
    }

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res
        .status(200)
        .type('text/html; charset=utf-8')
        .send(
          `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;color:#202124;"><div style="text-align:center;padding:32px;max-width:440px;background:#fff;border:1px solid #dadce0;border-radius:16px;"><h2 style="margin:0 0 8px;font-size:18px;">ملف غير نصي (${escapeHtmlAttr(contentType || 'غير معروف')})</h2><p style="font-size:13px;color:#5f6368;margin:0 0 16px;">يمكنك فتح هذا الملف أو تنزيله مباشرة.</p><a href="${escapeHtmlAttr(finalUrlStr)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#1a73e8;color:#fff;text-decoration:none;font-size:13px;font-weight:600;">فتح الرابط مباشرة</a></div></body></html>`
        );
    }

    const buf = await readResponseCapped(response, 1536 * 1024);
    const rendered = sanitizeAndRewriteHtml(buf.toString('utf-8'), finalUrlStr, nonce);
    return res.status(200).type('text/html; charset=utf-8').send(rendered);
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'انتهت مهلة الاتصال بالموقع.'
        : error instanceof Error
          ? error.message
          : 'تعذر عرض الصفحة داخل المتصفح.';
    return res
      .status(400)
      .type('text/html; charset=utf-8')
      .send(
        `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;color:#202124;"><div style="text-align:center;padding:32px;max-width:440px;background:#fff;border:1px solid #fad2cf;border-radius:16px;"><h2 style="margin:0 0 8px;font-size:16px;color:#c5221f;">${escapeHtmlAttr(message)}</h2><p style="font-size:13px;color:#5f6368;margin:0;">جرّب التبديل إلى وضع القراءة من الشريط العلوي أو إعادة المحاولة.</p></div></body></html>`
      );
  }
});

// Cloud SQL Protected User Data Routes (Firebase ID Token Verified)
app.post('/api/user/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });

    const user = await getOrCreateUser({
      uid,
      email,
      displayName: typeof req.body?.displayName === 'string' ? req.body.displayName : req.user?.name,
      avatarColor: typeof req.body?.avatarColor === 'string' ? req.body.avatarColor : '#4285F4',
      preferredEngine: typeof req.body?.preferredEngine === 'string' ? req.body.preferredEngine : 'hybrid',
      theme: typeof req.body?.theme === 'string' ? req.body.theme : 'light',
    });

    const [history, userBookmarks, userShortcuts] = await Promise.all([
      getUserHistory(uid),
      getUserBookmarks(uid),
      getUserShortcuts(uid),
    ]);

    return res.json({ user, history, bookmarks: userBookmarks, shortcuts: userShortcuts });
  } catch (error: unknown) {
    console.error('User sync error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'خطأ في مزامنة البيانات.' });
  }
});

app.patch('/api/user/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });

    const updated = await updateUserPreferences(uid, {
      preferredEngine: typeof req.body?.preferredEngine === 'string' ? req.body.preferredEngine : undefined,
      theme: typeof req.body?.theme === 'string' ? req.body.theme : undefined,
      displayName: typeof req.body?.displayName === 'string' ? req.body.displayName : undefined,
      avatarColor: typeof req.body?.avatarColor === 'string' ? req.body.avatarColor : undefined,
    });
    return res.json({ user: updated });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر تحديث التفضيلات.' });
  }
});

app.get('/api/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    const history = await getUserHistory(uid);
    return res.json({ history });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر جلب السجل.' });
  }
});

app.post('/api/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });

    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const engineMode = typeof req.body?.engineMode === 'string' ? req.body.engineMode : 'hybrid';
    const tab = typeof req.body?.tab === 'string' ? req.body.tab : 'all';
    if (!query) return res.status(400).json({ error: 'استعلام البحث مطلوب.' });

    const item = await addHistoryEntry(uid, email, { query, engineMode, tab });
    return res.json({ item });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر حفظ السجل.' });
  }
});

app.delete('/api/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    await clearUserHistory(uid);
    return res.json({ success: true });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر مسح السجل.' });
  }
});

app.get('/api/bookmarks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    const list = await getUserBookmarks(uid);
    return res.json({ bookmarks: list });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر جلب المفضلة.' });
  }
});

app.post('/api/bookmarks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!title || !url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'بيانات العلامة المرجعية غير صالحة.' });
    }

    const item = await addBookmarkEntry(uid, email, {
      title,
      url,
      snippet: typeof req.body?.snippet === 'string' ? req.body.snippet : '',
      displayLink: typeof req.body?.displayLink === 'string' ? req.body.displayLink : '',
      sourceType: typeof req.body?.sourceType === 'string' ? req.body.sourceType : 'google',
    });
    return res.json({ item });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر حفظ المفضلة.' });
  }
});

app.delete('/api/bookmarks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!url) return res.status(400).json({ error: 'الرابط مطلوب.' });
    await removeBookmarkEntry(uid, url);
    return res.json({ success: true });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر حذف المفضلة.' });
  }
});

app.post('/api/shortcuts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || '';
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const iconColor = typeof req.body?.iconColor === 'string' ? req.body.iconColor : '#4285F4';
    if (!title || !url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'بيانات الاختصار غير صالحة.' });
    }

    const item = await addShortcutEntry(uid, email, { title, url, iconColor });
    return res.json({ item });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر حفظ الاختصار.' });
  }
});

app.delete('/api/shortcuts/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'معرف الاختصار غير صالح.' });
    await removeShortcutEntry(uid, id);
    return res.json({ success: true });
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر حذف الاختصار.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NOVA Search Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
