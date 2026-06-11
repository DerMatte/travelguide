"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Hash, MapPin, Search, X } from "lucide-react";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { filterAndSortAirports, getUniqueCountries, regions } from "@/lib/airport-utils";
import {
  appendSearchTag,
  getActiveSearchTagTokens,
  parseSearchQuery,
  suggestLocations,
  suggestSearchTags,
  type LocationOption,
  type SearchTag,
} from "@/lib/search-query";
import { cn } from "@/lib/utils";
import type { Airport, AirportFilters, Region } from "@/lib/types";

interface AirportHeroSearchProps {
  airports: Airport[];
  filters: AirportFilters;
  onFiltersChange: (filters: AirportFilters) => void;
}

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="h-7 gap-1 rounded-full pr-1 pl-2.5 font-normal">
      {label}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
        aria-label={`Remove ${label} filter`}
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}

export function AirportHeroSearch({
  airports,
  filters,
  onFiltersChange,
}: AirportHeroSearchProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = filters.query;
  const availableCountries = useMemo(() => getUniqueCountries(airports), [airports]);

  const parsed = useMemo(() => parseSearchQuery(query), [query]);
  const visibleAirports = useMemo(
    () => filterAndSortAirports(airports, { ...filters, sort: "highest-score" }),
    [airports, filters],
  );

  const tagFragment = useMemo(() => {
    const hashIndex = query.lastIndexOf("#");
    if (hashIndex < 0) return null;
    const fragment = query.slice(hashIndex + 1);
    if (/\s/.test(fragment)) return null;
    return fragment;
  }, [query]);

  const locationQuery = useMemo(() => {
    const hashIndex = query.indexOf("#");
    const text = hashIndex >= 0 ? query.slice(0, hashIndex) : query;
    return text.trim();
  }, [query]);

  const tagSuggestions = useMemo(
    () => (tagFragment === null ? [] : suggestSearchTags(tagFragment)),
    [tagFragment],
  );

  const locationSuggestions = useMemo(
    () =>
      suggestLocations(locationQuery, {
        regions,
        countries: availableCountries,
        selectedRegions: filters.regions,
        selectedCountries: filters.countries,
      }),
    [
      availableCountries,
      filters.countries,
      filters.regions,
      locationQuery,
    ],
  );

  const continentSuggestions = locationSuggestions.filter(
    (option) => option.kind === "region",
  );
  const countrySuggestions = locationSuggestions.filter(
    (option) => option.kind === "country",
  );

  const activeHashTags = getActiveSearchTagTokens(query);
  const hasLocationFilters =
    filters.regions.length > 0 || filters.countries.length > 0;
  const hasActiveFilters = hasLocationFilters || activeHashTags.length > 0 || query.trim().length > 0;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function updateQuery(nextQuery: string) {
    onFiltersChange({ ...filters, query: nextQuery, searchScope: "all" });
  }

  function updateFilters(nextFilters: AirportFilters) {
    onFiltersChange(nextFilters);
  }

  function selectLocation(option: LocationOption) {
    if (option.kind === "region") {
      updateFilters({
        ...filters,
        regions: [...filters.regions, option.value as Region],
        query: "",
        searchScope: "all",
      });
    } else {
      updateFilters({
        ...filters,
        countries: [...filters.countries, option.value],
        query: "",
        searchScope: "all",
      });
    }
    inputRef.current?.focus();
  }

  function removeRegion(region: Region) {
    updateFilters({
      ...filters,
      regions: filters.regions.filter((item) => item !== region),
    });
  }

  function removeCountry(country: string) {
    updateFilters({
      ...filters,
      countries: filters.countries.filter((item) => item !== country),
    });
  }

  function selectTag(tag: SearchTag) {
    updateQuery(appendSearchTag(query, tag));
    inputRef.current?.focus();
  }

  function selectAirport(airport: Airport) {
    updateQuery(airport.iata);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearAll() {
    updateFilters({
      ...filters,
      query: "",
      regions: [],
      countries: [],
    });
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <Command
        shouldFilter={false}
        className="overflow-visible rounded-2xl border bg-card shadow-xl shadow-foreground/5"
      >
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 px-4 py-3",
            open && "border-b border-border/70",
          )}
        >
          <Search
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />

          {filters.regions.map((region) => (
            <FilterTag
              key={`region-${region}`}
              label={region}
              onRemove={() => removeRegion(region)}
            />
          ))}

          {filters.countries.map((country) => (
            <FilterTag
              key={`country-${country}`}
              label={country}
              onRemove={() => removeCountry(country)}
            />
          ))}

          {activeHashTags.map((tag) => (
            <Badge
              key={`hash-${tag}`}
              variant="outline"
              className="h-7 rounded-full font-normal"
            >
              #{tag}
            </Badge>
          ))}

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              }

              if (
                event.key === "Backspace" &&
                query === "" &&
                (filters.countries.length > 0 || filters.regions.length > 0)
              ) {
                if (filters.countries.length > 0) {
                  removeCountry(filters.countries[filters.countries.length - 1]!);
                } else {
                  removeRegion(filters.regions[filters.regions.length - 1]!);
                }
              }
            }}
            placeholder={
              hasLocationFilters
                ? "Search airports or add #tags…"
                : "Search airports, continents, or countries…"
            }
            autoComplete="off"
            spellCheck={false}
            aria-label="Search airports"
            aria-expanded={open}
            aria-controls="airport-hero-search-list"
            role="combobox"
            className="h-8 min-w-[10rem] flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Clear search and filters"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {open ? (
          <CommandList
            id="airport-hero-search-list"
            className="max-h-[min(24rem,calc(100vh-12rem))] p-2"
          >
            {continentSuggestions.length > 0 ? (
              <CommandGroup heading="Continents">
                {continentSuggestions.map((option) => (
                  <CommandItem
                    key={`region-${option.value}`}
                    value={`region-${option.value}`}
                    onSelect={() => selectLocation(option)}
                    className="gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        Continent filter
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {countrySuggestions.length > 0 ? (
              <CommandGroup heading="Countries">
                {countrySuggestions.map((option) => (
                  <CommandItem
                    key={`country-${option.value}`}
                    value={`country-${option.value}`}
                    onSelect={() => selectLocation(option)}
                    className="gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        Country filter
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {tagSuggestions.length > 0 ? (
              <CommandGroup heading="Tags">
                {tagSuggestions.map((tag) => (
                  <CommandItem
                    key={`${tag.kind}-${tag.token}`}
                    value={`tag-${tag.token}`}
                    onSelect={() => selectTag(tag)}
                    className="gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <Hash className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">#{tag.token}</span>
                      <span className="block text-xs text-muted-foreground">
                        {tag.label}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            <CommandGroup heading={`Airports (${visibleAirports.length})`}>
              {visibleAirports.length === 0 ? (
                <CommandEmpty>
                  No matching airports. Try another search or location filter.
                </CommandEmpty>
              ) : (
                visibleAirports.map((airport) => (
                  <CommandItem
                    key={airport.iata}
                    value={airport.iata}
                    onSelect={() => selectAirport(airport)}
                    className="gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted font-mono text-xs font-semibold">
                      {airport.iata}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{airport.shortName}</span>
                        <DisruptionBadge status={airport.disruption.status} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {airport.city}, {airport.country} · Score{" "}
                        {airport.airportistScore.toFixed(1)}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {parsed.text ? "Filter" : "Select"}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        ) : null}
      </Command>
    </div>
  );
}
