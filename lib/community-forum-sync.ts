import fs from "node:fs/promises";
import path from "node:path";
import {
  COMMUNITY_FORUM_RSS_URL,
  type CommunityForumThreadActivity,
  isReferenceForumThread,
  matchIatasFromForumItem,
  normalizeThreadUrl,
  stripHtml,
} from "./community-forum";

const MCT_THREAD_URL =
  "https://www.vielfliegertreff.de/forum/threads/reicht-meine-umsteigezeit-in-xxx.43462/";

const DATA_DIR = path.join(process.cwd(), ".data");
export const COMMUNITY_FORUM_STATE_PATH = path.join(DATA_DIR, "community-forum-sync.json");

export interface CommunityForumPendingUpdate {
  iata: string;
  threads: CommunityForumThreadActivity[];
  referenceThreads: CommunityForumThreadActivity[];
  detectedAt: string;
}

export interface CommunityForumSyncState {
  syncedAt: string;
  seenItems: Record<string, string>;
  pending: CommunityForumPendingUpdate[];
  referenceActivity: CommunityForumThreadActivity[];
}

export interface CommunityForumSyncResult {
  state: CommunityForumSyncState;
  newItems: number;
  changedAirports: string[];
  referenceActivity: CommunityForumThreadActivity[];
}

interface RssItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  author?: string;
  snippet: string;
}

export async function loadCommunityForumState(): Promise<CommunityForumSyncState> {
  try {
    const raw = await fs.readFile(COMMUNITY_FORUM_STATE_PATH, "utf8");
    return JSON.parse(raw) as CommunityForumSyncState;
  } catch {
    return {
      syncedAt: "",
      seenItems: {},
      pending: [],
      referenceActivity: [],
    };
  }
}

export async function saveCommunityForumState(state: CommunityForumSyncState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(COMMUNITY_FORUM_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export async function syncCommunityForumFeed(
  knownIatas: readonly string[],
  options?: { baselineOnly?: boolean },
): Promise<CommunityForumSyncResult> {
  const baselineOnly = options?.baselineOnly ?? false;
  const knownSet = new Set(knownIatas.map((iata) => iata.toUpperCase()));
  const state = await loadCommunityForumState();
  const items = await fetchForumRssItems();
  const pendingByIata = baselineOnly ? new Map() : indexPendingUpdates(state.pending);
  const referenceActivity: CommunityForumThreadActivity[] = [];
  let newItems = 0;

  for (const item of items) {
    const previousPubDate = state.seenItems[item.guid];
    const isNew = previousPubDate === undefined;
    const isUpdated = previousPubDate !== undefined && previousPubDate !== item.pubDate;

    if (!isNew && !isUpdated) continue;

    newItems += 1;
    state.seenItems[item.guid] = item.pubDate;

    if (baselineOnly) continue;

    const activity: CommunityForumThreadActivity = {
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      author: item.author,
      snippet: item.snippet,
    };

    if (isReferenceForumThread(item.link)) {
      referenceActivity.push(activity);

      if (normalizeThreadUrl(item.link) === normalizeThreadUrl(MCT_THREAD_URL)) {
        const matchedIatas = matchIatasFromForumItem(
          item.title,
          item.link,
          knownSet,
          item.snippet,
        );
        for (const iata of matchedIatas) {
          mergePendingUpdate(pendingByIata, iata, activity);
        }
      } else if (!state.referenceActivity.some((entry) => entry.link === activity.link)) {
        state.referenceActivity.push(activity);
      }

      continue;
    }

    const matchedIatas = matchIatasFromForumItem(item.title, item.link, knownSet, item.snippet);
    for (const iata of matchedIatas) {
      mergePendingUpdate(pendingByIata, iata, activity);
    }
  }

  state.pending = [...pendingByIata.values()].sort((a, b) => a.iata.localeCompare(b.iata));
  state.syncedAt = new Date().toISOString();

  await saveCommunityForumState(state);

  return {
    state,
    newItems,
    changedAirports: state.pending.map((entry) => entry.iata),
    referenceActivity,
  };
}

export async function getPendingUpdate(
  iata: string,
): Promise<CommunityForumPendingUpdate | undefined> {
  const state = await loadCommunityForumState();
  const pending = state.pending.find((entry) => entry.iata === iata.toUpperCase());

  if (!pending && state.referenceActivity.length === 0) {
    return undefined;
  }

  return {
    iata: iata.toUpperCase(),
    threads: pending?.threads ?? [],
    referenceThreads: [
      ...(pending?.referenceThreads ?? []),
      ...state.referenceActivity.filter(
        (entry) => !pending?.referenceThreads.some((existing) => existing.link === entry.link),
      ),
    ],
    detectedAt: pending?.detectedAt ?? new Date().toISOString(),
  };
}

export async function clearPendingUpdate(iata: string): Promise<void> {
  const state = await loadCommunityForumState();
  state.pending = state.pending.filter((entry) => entry.iata !== iata.toUpperCase());

  if (state.pending.length === 0) {
    state.referenceActivity = [];
  }

  await saveCommunityForumState(state);
}

async function fetchForumRssItems(): Promise<RssItem[]> {
  const response = await fetch(COMMUNITY_FORUM_RSS_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });

  if (!response.ok) {
    throw new Error(`Community forum RSS returned ${response.status}`);
  }

  const xml = await response.text();
  return parseRssItems(xml);
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const block of itemBlocks) {
    const title = readXmlTag(block, "title");
    const link = readXmlTag(block, "link");
    const guid = readXmlTag(block, "guid") || link;
    const pubDate = readXmlTag(block, "pubDate");

    if (!title || !link || !guid) continue;

    items.push({
      guid,
      title: decodeXmlEntities(title),
      link,
      pubDate: pubDate ?? "",
      author: parseRssAuthor(readXmlTag(block, "author")),
      snippet: stripHtml(readXmlTag(block, "content:encoded") ?? ""),
    });
  }

  return items;
}

function readXmlTag(block: string, tag: string): string | undefined {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(pattern);
  if (!match) return undefined;

  const value = match[1].trim();
  if (value.startsWith("<![CDATA[")) {
    return value.slice(9, -3);
  }

  return value;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseRssAuthor(raw?: string): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/\(([^)]+)\)\s*$/);
  return match?.[1] ?? raw;
}

function indexPendingUpdates(
  pending: CommunityForumPendingUpdate[],
): Map<string, CommunityForumPendingUpdate> {
  return new Map(pending.map((entry) => [entry.iata, entry]));
}

function mergePendingUpdate(
  pendingByIata: Map<string, CommunityForumPendingUpdate>,
  iata: string,
  thread: CommunityForumThreadActivity,
): void {
  const normalized = iata.toUpperCase();
  const existing =
    pendingByIata.get(normalized) ??
    ({
      iata: normalized,
      threads: [],
      referenceThreads: [],
      detectedAt: new Date().toISOString(),
    } satisfies CommunityForumPendingUpdate);

  if (!existing.threads.some((entry) => normalizeThreadUrl(entry.link) === normalizeThreadUrl(thread.link))) {
    existing.threads.push(thread);
  }

  pendingByIata.set(normalized, existing);
}
