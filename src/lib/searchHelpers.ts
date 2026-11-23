import { KnowledgeGraphData, SearchResultItem, SearchTab } from '../types';

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function evaluateMathQuery(query: string): { expression: string; result: string } | null {
  const trimmed = query.trim();
  if (!/^[0-9+\-*/().%\s^]+$/.test(trimmed)) return null;
  if (!/[+\-*/%^]/.test(trimmed)) return null;
  if (trimmed.length > 80) return null;

  try {
    const normalized = trimmed.replace(/\^/g, '**');
    const fn = new Function(`"use strict"; return (${normalized});`);
    const value = fn();
    if (typeof value === 'number' && Number.isFinite(value)) {
      const formatted = Number.isInteger(value)
        ? value.toLocaleString('en-US')
        : Number(value.toFixed(6)).toLocaleString('en-US');
      return { expression: trimmed, result: formatted };
    }
    return null;
  } catch {
    return null;
  }
}

export function getExternalSearchUrl(
  engine: 'google' | 'duckduckgo',
  query: string,
  tab: SearchTab
): string {
  const q = encodeURIComponent(query);
  if (engine === 'google') {
    if (tab === 'images') return `https://www.google.com/search?tbm=isch&q=${q}`;
    if (tab === 'videos') return `https://www.google.com/search?tbm=vid&q=${q}`;
    if (tab === 'news') return `https://www.google.com/search?tbm=nws&q=${q}`;
    return `https://www.google.com/search?q=${q}`;
  }
  if (tab === 'images') return `https://duckduckgo.com/?q=${q}&iax=images&ia=images`;
  if (tab === 'videos') return `https://duckduckgo.com/?q=${q}&iax=videos&ia=videos`;
  if (tab === 'news') return `https://duckduckgo.com/?q=${q}&iar=news&ia=news`;
  return `https://duckduckgo.com/?q=${q}`;
}

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  } catch {
    return '';
  }
}

export async function fetchInstantAndDuckDuckGo(
  query: string,
  tab: SearchTab = 'all',
  lang: 'auto' | 'ar' | 'en' = 'auto'
): Promise<{
  knowledgeGraph: KnowledgeGraphData | null;
  instantItems: SearchResultItem[];
  imageItems: SearchResultItem[];
}> {
  const res = await fetch(
    `/api/search/instant?q=${encodeURIComponent(query)}&tab=${encodeURIComponent(tab)}&lang=${encodeURIComponent(lang)}`
  );
  if (!res.ok) {
    return { knowledgeGraph: null, instantItems: [], imageItems: [] };
  }
  const data = await res.json();

  if (tab === 'images') {
    const rawImgs = Array.isArray(data.images) ? data.images : [];
    const imageItems: SearchResultItem[] = rawImgs.map(
      (
        img: {
          title: string;
          url: string;
          displayLink: string;
          contextLink: string;
          thumbnailLink: string;
          width?: number;
          height?: number;
        },
        idx: number
      ) => ({
        id: `img_${idx}`,
        title: img.title || query,
        url: img.url,
        displayLink: img.displayLink || 'wikimedia.org',
        snippet: '',
        source: 'google' as const,
        image: {
          contextLink: img.contextLink,
          thumbnailLink: img.thumbnailLink,
          width: img.width,
          height: img.height,
        },
      })
    );
    return { knowledgeGraph: null, instantItems: [], imageItems };
  }

  const ddg = data.ddg;
  const webResults = Array.isArray(data.webResults) ? data.webResults : [];
  const wikiSummary = data.wikiSummary;
  const wikiResults = Array.isArray(data.wikiResults) ? data.wikiResults : [];

  const relatedTopics: { text: string; url: string }[] = [];
  const instantItems: SearchResultItem[] = [];
  const seenUrls = new Set<string>();

  const pushItem = (item: SearchResultItem) => {
    if (!item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    instantItems.push(item);
  };

  // Organic Web / News results (from Google News RSS or DuckDuckGo Web)
  webResults.forEach(
    (
      w: { title: string; url: string; snippet: string; displayLink: string; datePublished?: string },
      idx: number
    ) => {
      pushItem({
        id: `web_${idx}`,
        title: w.title,
        url: w.url,
        displayLink: w.displayLink,
        snippet: w.snippet || '',
        favicon: getFaviconUrl(w.url),
        source: tab === 'news' ? 'google' : 'duckduckgo',
        datePublished: w.datePublished,
      });
    }
  );

  if (ddg?.AbstractURL && ddg?.AbstractText) {
    pushItem({
      id: 'ddg_abstract',
      title: ddg.Heading || query,
      url: ddg.AbstractURL,
      displayLink: ddg.AbstractSource || 'DuckDuckGo',
      snippet: ddg.AbstractText,
      favicon: getFaviconUrl(ddg.AbstractURL),
      source: 'duckduckgo',
    });
  }

  if (Array.isArray(ddg?.Results)) {
    ddg.Results.forEach((r: { FirstURL?: string; Text?: string }, i: number) => {
      if (r.FirstURL && r.Text) {
        let host = 'duckduckgo.com';
        try {
          host = new URL(r.FirstURL).hostname;
        } catch {
          // fallback
        }
        pushItem({
          id: `ddg_res_${i}`,
          title: r.Text.split(' - ')[0] || r.Text,
          url: r.FirstURL,
          displayLink: host,
          snippet: r.Text,
          favicon: getFaviconUrl(r.FirstURL),
          source: 'duckduckgo',
        });
      }
    });
  }

  if (Array.isArray(ddg?.RelatedTopics)) {
    for (const topic of ddg.RelatedTopics) {
      if (topic.FirstURL && topic.Text) {
        relatedTopics.push({ text: topic.Text, url: topic.FirstURL });
        if (instantItems.length < 10) {
          pushItem({
            id: `ddg_topic_${instantItems.length}`,
            title: topic.Text.split(' - ')[0]?.slice(0, 90) || topic.Text.slice(0, 90),
            url: topic.FirstURL,
            displayLink: 'duckduckgo.com',
            snippet: topic.Text,
            favicon: getFaviconUrl(topic.FirstURL),
            source: 'duckduckgo',
          });
        }
      } else if (Array.isArray(topic.Topics)) {
        for (const sub of topic.Topics) {
          if (sub.FirstURL && sub.Text && relatedTopics.length < 6) {
            relatedTopics.push({ text: sub.Text, url: sub.FirstURL });
          }
        }
      }
    }
  }

  wikiResults.forEach(
    (w: { title: string; snippet: string; url: string; displayLink: string }, idx: number) => {
      pushItem({
        id: `wiki_${idx}`,
        title: w.title,
        url: w.url,
        displayLink: w.displayLink,
        snippet: w.snippet || 'مقال موسوعي من ويكيبيديا',
        favicon: getFaviconUrl(w.url),
        source: 'wiki',
      });
    }
  );

  let knowledgeGraph: KnowledgeGraphData | null = null;
  if (ddg?.AbstractText || wikiSummary?.extract) {
    const rawImage =
      wikiSummary?.thumbnail ||
      (ddg?.Image && typeof ddg.Image === 'string'
        ? ddg.Image.startsWith('http')
          ? ddg.Image
          : `https://duckduckgo.com${ddg.Image}`
        : undefined);

    const infobox: { label: string; value: string }[] = [];
    if (Array.isArray(ddg?.Infobox?.content)) {
      for (const row of ddg.Infobox.content.slice(0, 5)) {
        if (row.label && row.value && typeof row.value === 'string') {
          infobox.push({ label: row.label, value: row.value });
        }
      }
    }

    knowledgeGraph = {
      title: wikiSummary?.title || ddg?.Heading || query,
      description: wikiSummary?.description || ddg?.Entity || undefined,
      abstractText: wikiSummary?.extract || ddg?.AbstractText || '',
      abstractSource: wikiSummary ? 'ويكيبيديا' : ddg?.AbstractSource || 'DuckDuckGo',
      abstractUrl: wikiSummary?.url || ddg?.AbstractURL || undefined,
      imageUrl: rawImage,
      relatedTopics: relatedTopics.slice(0, 5),
      infobox,
    };
  }

  return { knowledgeGraph, instantItems, imageItems: [] };
}
