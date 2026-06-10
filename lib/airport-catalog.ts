import {
  getAirportContent,
  getAllAirportIatas,
  getAirportGuideSummary,
  type AirportContent,
} from "@/lib/airport-content";
import { getAirportByIata, type AirportRecord } from "@/lib/airports";
import { airports as seedAirports } from "@/lib/data";
import type { Airport, Disruption, Region, Tip, TipCategory } from "@/lib/types";

const COUNTRY_REGION: Record<string, Region> = {
  US: "North America",
  CA: "North America",
  MX: "North America",
  GB: "Europe",
  FR: "Europe",
  DE: "Europe",
  NL: "Europe",
  ES: "Europe",
  IT: "Europe",
  CH: "Europe",
  AT: "Europe",
  BE: "Europe",
  SE: "Europe",
  NO: "Europe",
  DK: "Europe",
  FI: "Europe",
  PL: "Europe",
  CZ: "Europe",
  HU: "Europe",
  GR: "Europe",
  PT: "Europe",
  IE: "Europe",
  TR: "Europe",
  AE: "Middle East",
  QA: "Middle East",
  SA: "Middle East",
  IL: "Middle East",
  CN: "Asia-Pacific",
  JP: "Asia-Pacific",
  KR: "Asia-Pacific",
  SG: "Asia-Pacific",
  TH: "Asia-Pacific",
  IN: "Asia-Pacific",
  AU: "Asia-Pacific",
  NZ: "Asia-Pacific",
  TW: "Asia-Pacific",
  HK: "Asia-Pacific",
  ID: "Asia-Pacific",
  MY: "Asia-Pacific",
  PH: "Asia-Pacific",
  VN: "Asia-Pacific",
};

const TIP_CATEGORIES: TipCategory[] = [
  "navigation",
  "transport",
  "security",
  "food",
  "layover",
  "lounge",
  "family",
];

function inferRegion(countryCode: string, countryName: string): Region {
  const fromCode = COUNTRY_REGION[countryCode.toUpperCase()];
  if (fromCode) return fromCode;

  const normalized = countryName.toLowerCase();
  if (
    normalized.includes("united states") ||
    normalized.includes("canada") ||
    normalized.includes("mexico")
  ) {
    return "North America";
  }
  if (
    normalized.includes("emirates") ||
    normalized.includes("qatar") ||
    normalized.includes("saudi") ||
    normalized.includes("israel")
  ) {
    return "Middle East";
  }
  if (
    normalized.includes("china") ||
    normalized.includes("japan") ||
    normalized.includes("korea") ||
    normalized.includes("india") ||
    normalized.includes("australia") ||
    normalized.includes("singapore") ||
    normalized.includes("thailand")
  ) {
    return "Asia-Pacific";
  }
  return "Europe";
}

function defaultDisruption(): Disruption {
  return {
    status: "normal",
    departureDelayMinutes: 12,
    departureDelayPercent: 18,
    arrivalDelayMinutes: 10,
    arrivalDelayPercent: 15,
    cancellationsPercent: 2,
    alerts: [],
    lastUpdated: new Date(),
  };
}

function buildShortName(name: string, city: string, iata: string): string {
  const trimmed = name.replace(/\s+International Airport$/i, "").trim();
  if (trimmed.length <= 32) return trimmed;
  return `${city} ${iata}`;
}

function guideTipsToAirportTips(iata: string, content: AirportContent): Tip[] {
  const guide = getAirportGuideSummary(content);
  const fromBento = guide.importantTips.map((tip, index) => ({
    id: `${iata.toLowerCase()}-tip-${index + 1}`,
    category: mapTipCategory(tip.category),
    title: tip.title,
    summary: tip.summary,
    details: tip.detail ?? tip.summary,
  }));

  if (fromBento.length > 0) return fromBento.slice(0, 4);

  const hacks = content.content.match(/^## Best Airport Tricks[\s\S]*?(?=^## |\Z)/m);
  if (!hacks) return [];

  return hacks[0]
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter((line) => line.length > 20 && !line.startsWith("#"))
    .slice(0, 4)
    .map((line, index) => ({
      id: `${iata.toLowerCase()}-hack-${index + 1}`,
      category: TIP_CATEGORIES[index % TIP_CATEGORIES.length],
      title: line.replace(/\*\*/g, "").slice(0, 80),
      summary: line.replace(/\*\*/g, "").slice(0, 140),
      details: line.replace(/\*\*/g, ""),
    }));
}

function mapTipCategory(
  category: "timing" | "terminal" | "food" | "status",
): TipCategory {
  switch (category) {
    case "timing":
      return "security";
    case "terminal":
      return "navigation";
    case "food":
      return "food";
    case "status":
      return "layover";
    default: {
      const exhaustiveCheck: never = category;
      return exhaustiveCheck;
    }
  }
}

function buildAirportFromContent(
  content: AirportContent,
  record?: AirportRecord,
): Airport {
  const { frontmatter } = content;
  const iata = (frontmatter.iata ?? record?.iata_code ?? "").toString().trim().toUpperCase();
  if (!iata) return null as never;
  const guide = getAirportGuideSummary(content);
  const city = frontmatter.city || record?.city_name || iata;
  const country = frontmatter.country || record?.iata_country_code || "Unknown";
  const countryCode = record?.iata_country_code ?? "";
  const name = frontmatter.name || record?.name || `${iata} Airport`;
  const summary =
    guide.quickFacts[0] ??
    `Practical traveler guide for ${name} with tips on security, connections, and ground transport.`;

  return {
    slug: iata.toLowerCase(),
    iata,
    icao: record?.icao_code ?? iata,
    name,
    shortName: buildShortName(name, city, iata),
    city,
    country,
    region: inferRegion(countryCode, country),
    coordinates: {
      latitude: record?.latitude ?? 0,
      longitude: record?.longitude ?? 0,
    },
    airportistScore: 7.2,
    scoreBreakdown: {
      comfort: 7.1,
      navigation: 7.0,
      food: 7.1,
      transport: 7.2,
      disruptionResilience: 7.0,
    },
    stats: {
      annualPassengers: "Major hub",
      terminals: guide.quickFacts.find((fact) => /terminal/i.test(fact)) ?? "Multiple terminals",
      onTimePercentage: 78,
      averageSecurityMinutes: 18,
    },
    summary,
    bestFor: guide.quickFacts.slice(0, 3),
    watchOutFor: ["Peak security queues", "Terminal changes", "Verify live alerts"],
    amenities: [
      {
        id: `${iata.toLowerCase()}-transport`,
        label: "Ground transport",
        category: "transport",
        description: "See the guide for the best airport-to-city options.",
        quality: "good",
        isFeatured: true,
      },
      {
        id: `${iata.toLowerCase()}-wifi`,
        label: "Airport WiFi",
        category: "wifi",
        description: "Check the guide for login quirks and reliable work spots.",
        quality: "good",
      },
    ],
    importantTips: guide.importantTips,
    tips: guideTipsToAirportTips(iata, content),
    transport: [
      {
        type: "train",
        name: "Public rail or metro",
        summary: "Often the best value link to the city center.",
        timeToCity: "20-45 min",
        cost: "$",
        insiderTip: "See the Ground Transport section in the full guide.",
      },
    ],
    disruption: defaultDisruption(),
    reviews: [],
    photos: [
      {
        id: `${iata.toLowerCase()}-hero`,
        alt: `${name} terminal overview`,
        colorClass: "from-sky-200 via-blue-100 to-indigo-200",
      },
    ],
  };
}

async function loadHonestAirportCatalog(): Promise<Airport[]> {
  const seedByIata = new Map(seedAirports.map((airport) => [airport.iata, airport]));
  const iatas = await getAllAirportIatas();
  const airports: Airport[] = [];

  for (const iata of iatas) {
    const seed = seedByIata.get(iata);
    if (seed) {
      airports.push(seed);
      continue;
    }

    const content = await getAirportContent(iata);
    if (!content?.frontmatter.iata) continue;

    airports.push(buildAirportFromContent(content, getAirportByIata(iata)));
  }

  return airports.sort((a, b) => a.name.localeCompare(b.name));
}

async function getHonestAirportBySlug(slug: string): Promise<Airport | undefined> {
  const airports = await loadHonestAirportCatalog();
  const normalized = slug.trim().toLowerCase();
  return airports.find((airport) => airport.slug === normalized);
}

async function getHonestAirportSlugs(): Promise<string[]> {
  const airports = await loadHonestAirportCatalog();
  return airports.map((airport) => airport.slug);
}

export async function getAllHonestAirports(): Promise<Airport[]> {
  const airports = await loadHonestAirportCatalog();
  return airports.sort((a, b) => b.airportistScore - a.airportistScore);
}

export async function getAirportBySlug(slug: string): Promise<Airport | undefined> {
  return getHonestAirportBySlug(slug);
}

export async function getAirportSlugs(): Promise<string[]> {
  return getHonestAirportSlugs();
}
