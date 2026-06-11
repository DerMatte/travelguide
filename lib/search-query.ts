import type {
  AmenityCategory,
  DisruptionStatus,
  Region,
} from "@/lib/types";

export interface SearchTag {
  token: string;
  label: string;
  kind: "amenity" | "disruption";
}

export interface LocationOption {
  kind: "region" | "country";
  value: string;
  label: string;
}

export interface ParsedSearchQuery {
  text: string;
  amenities: AmenityCategory[];
  disruptionStatuses: DisruptionStatus[];
}

const amenityCategories: AmenityCategory[] = [
  "food",
  "lounge",
  "wifi",
  "family",
  "accessibility",
  "transport",
  "shopping",
  "sleep",
];

const disruptionStatuses: DisruptionStatus[] = [
  "normal",
  "minor",
  "moderate",
  "severe",
];

function amenityLabel(category: AmenityCategory): string {
  switch (category) {
    case "food":
      return "Food";
    case "lounge":
      return "Has Lounge";
    case "wifi":
      return "Fast WiFi";
    case "family":
      return "Family Friendly";
    case "accessibility":
      return "Accessibility";
    case "transport":
      return "Easy Transport";
    case "shopping":
      return "Shopping";
    case "sleep":
      return "Sleep Options";
    default: {
      const exhaustiveCheck: never = category;
      return exhaustiveCheck;
    }
  }
}

function disruptionLabel(status: DisruptionStatus): string {
  switch (status) {
    case "normal":
      return "Normal";
    case "minor":
      return "Minor";
    case "moderate":
      return "Moderate";
    case "severe":
      return "Severe";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function slugifyTag(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const searchTags: SearchTag[] = [
  ...amenityCategories.map((category) => ({
    token: category,
    label: amenityLabel(category),
    kind: "amenity" as const,
  })),
  ...disruptionStatuses.map((status) => ({
    token: status,
    label: disruptionLabel(status),
    kind: "disruption" as const,
  })),
];

export const continentOptions: LocationOption[] = (
  [
    "North America",
    "Europe",
    "Asia-Pacific",
    "Middle East",
  ] as Region[]
).map((region) => ({
  kind: "region" as const,
  value: region,
  label: region,
}));

function findTag(token: string): SearchTag | undefined {
  const normalized = slugifyTag(token);
  return searchTags.find((tag) => tag.token === normalized);
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const amenities: AmenityCategory[] = [];
  const disruptionStatusesParsed: DisruptionStatus[] = [];
  const textParts: string[] = [];

  for (const part of query.split(/\s+/)) {
    if (!part) continue;

    if (part.startsWith("#")) {
      const tag = findTag(part.slice(1));
      if (!tag) continue;

      switch (tag.kind) {
        case "amenity":
          if (!amenities.includes(tag.token as AmenityCategory)) {
            amenities.push(tag.token as AmenityCategory);
          }
          break;
        case "disruption":
          if (!disruptionStatusesParsed.includes(tag.token as DisruptionStatus)) {
            disruptionStatusesParsed.push(tag.token as DisruptionStatus);
          }
          break;
        default: {
          const exhaustiveCheck: never = tag.kind;
          return exhaustiveCheck;
        }
      }
      continue;
    }

    textParts.push(part);
  }

  return {
    text: textParts.join(" "),
    amenities,
    disruptionStatuses: disruptionStatusesParsed,
  };
}

export function countryOptions(countries: string[]): LocationOption[] {
  return countries.map((country) => ({
    kind: "country" as const,
    value: country,
    label: country,
  }));
}

export function suggestLocations(
  query: string,
  options: {
    regions: Region[];
    countries: string[];
    selectedRegions: Region[];
    selectedCountries: string[];
  },
): LocationOption[] {
  const normalizedQuery = slugifyTag(query.replace(/\s+/g, "-"));
  const allOptions = [
    ...continentOptions.filter((option) => !options.selectedRegions.includes(option.value as Region)),
    ...countryOptions(options.countries).filter(
      (option) => !options.selectedCountries.includes(option.value),
    ),
  ];

  if (!normalizedQuery) return allOptions;

  return allOptions.filter(
    (option) =>
      slugifyTag(option.label).includes(normalizedQuery) ||
      option.label.toLowerCase().includes(query.toLowerCase()),
  );
}

export function suggestSearchTags(fragment: string): SearchTag[] {
  const normalized = slugifyTag(fragment);
  if (!normalized) return searchTags;

  return searchTags.filter(
    (tag) =>
      tag.token.startsWith(normalized) ||
      slugifyTag(tag.label).startsWith(normalized),
  );
}

export function appendSearchTag(query: string, tag: SearchTag): string {
  const trimmed = query.trim();
  const hashIndex = trimmed.lastIndexOf("#");
  const prefix =
    hashIndex >= 0 ? trimmed.slice(0, hashIndex).trimEnd() : trimmed;
  const nextQuery = prefix ? `${prefix} #${tag.token}` : `#${tag.token}`;
  return `${nextQuery} `;
}

export function getActiveSearchTagTokens(query: string): string[] {
  const tokens: string[] = [];

  for (const part of query.split(/\s+/)) {
    if (!part.startsWith("#")) continue;
    const tag = findTag(part.slice(1));
    if (tag) tokens.push(tag.token);
  }

  return tokens;
}
