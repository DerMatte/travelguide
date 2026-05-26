/** Frequent-flyer community forum — Airports & Lounges section (XenForo RSS). */
import { matchIataCodesInText } from "./airports";

export const COMMUNITY_FORUM_RSS_URL =
  "https://www.vielfliegertreff.de/forum/forums/airports-lounges.12/-/index.rss";

export interface CommunityForumThreadActivity {
  title: string;
  link: string;
  pubDate: string;
  author?: string;
  snippet: string;
}

/** Explicit airport megathreads — thread URL → IATA codes. */
export const COMMUNITY_FORUM_AIRPORT_THREADS: Record<string, readonly string[]> = {
  "https://www.vielfliegertreff.de/forum/threads/news-rund-um-den-flughafen-muenchen.71994/": ["MUC"],
  "https://www.vielfliegertreff.de/forum/threads/bkk-immigration-usw.160542/": ["BKK"],
  "https://www.vielfliegertreff.de/forum/threads/bkk-lounge-bangkok-offen-lh-star-alliance.142428/": ["BKK"],
  "https://www.vielfliegertreff.de/forum/threads/news-rund-um-den-frankfurter-flughafen.1029/": ["FRA"],
  "https://www.vielfliegertreff.de/forum/threads/infrastruktur-am-frankfurter-flughafen-gates-ankuenfte-siko-etc.155832/":
    ["FRA"],
  "https://www.vielfliegertreff.de/forum/threads/airport-berlin-hauptstadtflughafen-ber.9484/": ["BER"],
  "https://www.vielfliegertreff.de/forum/threads/aktuelles-zum-flughafen-duesseldorf.57808/": ["DUS"],
  "https://www.vielfliegertreff.de/forum/threads/cgn-airport.123042/": ["CGN"],
  "https://www.vielfliegertreff.de/forum/threads/flughafen-wien.25921/": ["VIE"],
  "https://www.vielfliegertreff.de/forum/threads/ham-nur-gefuehlt-immer-schlechter.111751/": ["HAM"],
};

/** Cross-airport reference threads — include snippets when any airport is reviewed. */
export const COMMUNITY_FORUM_REFERENCE_THREADS: readonly string[] = [
  "https://www.vielfliegertreff.de/forum/threads/reicht-meine-umsteigezeit-in-xxx.43462/",
  "https://www.vielfliegertreff.de/forum/threads/transport-flughafen-stadt-neuer-weltweiter-uebersichtsthread.127384/",
  "https://www.vielfliegertreff.de/forum/threads/neu-flughaefen-mit-freiem-internet.15311/",
  "https://www.vielfliegertreff.de/forum/threads/wasser-am-flughafen-verfuegbarkeit-und-preise.106754/",
  "https://www.vielfliegertreff.de/forum/threads/referenzthread-fast-track-handhabungen-alliance.8491/",
];

const THREAD_URL_TO_IATAS = buildThreadUrlIndex();

function buildThreadUrlIndex(): Map<string, readonly string[]> {
  const index = new Map<string, readonly string[]>();

  for (const [url, iatas] of Object.entries(COMMUNITY_FORUM_AIRPORT_THREADS)) {
    index.set(normalizeThreadUrl(url), iatas);
  }

  return index;
}

export function normalizeThreadUrl(url: string): string {
  const match = url.match(/^(https?:\/\/[^/]+\/forum\/threads\/[^/?#]+\.\d+\/?)/i);
  if (!match) return url.replace(/\/$/, "") + "/";
  return match[1].endsWith("/") ? match[1] : `${match[1]}/`;
}

export function matchIatasFromForumItem(
  title: string,
  link: string,
  knownIatas: ReadonlySet<string>,
  snippet = "",
): string[] {
  const matched = new Set<string>();
  const threadUrl = normalizeThreadUrl(link);

  for (const iata of THREAD_URL_TO_IATAS.get(threadUrl) ?? []) {
    if (knownIatas.has(iata)) matched.add(iata);
  }

  const haystack = `${title} ${snippet} ${link}`;
  for (const iata of matchIataCodesInText(haystack, knownIatas)) {
    matched.add(iata);
  }

  return [...matched].sort();
}

export function isReferenceForumThread(link: string): boolean {
  const normalized = normalizeThreadUrl(link);
  return COMMUNITY_FORUM_REFERENCE_THREADS.some((url) => normalizeThreadUrl(url) === normalized);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatForumActivityForPrompt(
  airportThreads: CommunityForumThreadActivity[],
  referenceThreads: CommunityForumThreadActivity[],
): string {
  const sections: string[] = [];

  if (airportThreads.length > 0) {
    sections.push(
      "### Airport-specific threads (new activity)",
      ...airportThreads.map(formatThreadBullet),
    );
  }

  if (referenceThreads.length > 0) {
    sections.push(
      "### Reference threads (new activity — check for relevant tips)",
      ...referenceThreads.map(formatThreadBullet),
    );
  }

  return sections.join("\n\n");
}

function formatThreadBullet(thread: CommunityForumThreadActivity): string {
  const snippet = thread.snippet ? `\n  Snippet: ${thread.snippet.slice(0, 400)}` : "";
  const author = thread.author ? ` — ${thread.author}` : "";
  return `- **${thread.title}** (${thread.pubDate}${author})\n  ${thread.link}${snippet}`;
}
