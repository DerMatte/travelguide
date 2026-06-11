"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Search, X } from "lucide-react";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { filterAndSortAirports } from "@/lib/airport-utils";
import {
  appendSearchTag,
  getActiveSearchTagTokens,
  parseSearchQuery,
  suggestSearchTags,
  type SearchTag,
} from "@/lib/search-query";
import { cn } from "@/lib/utils";
import type { Airport, AirportFilters } from "@/lib/types";

interface AirportHeroSearchProps {
  airports: Airport[];
  filters: AirportFilters;
  onFiltersChange: (filters: AirportFilters) => void;
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

  const tagSuggestions = useMemo(
    () => (tagFragment === null ? [] : suggestSearchTags(tagFragment)),
    [tagFragment],
  );

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

  function selectTag(tag: SearchTag) {
    updateQuery(appendSearchTag(query, tag));
    inputRef.current?.focus();
  }

  function selectAirport(airport: Airport) {
    updateQuery(airport.iata);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearQuery() {
    updateQuery("");
    inputRef.current?.focus();
  }

  const activeTags = getActiveSearchTagTokens(query);

  return (
    <div ref={containerRef} className="relative">
      <Command
        shouldFilter={false}
        className="overflow-visible rounded-2xl border bg-card shadow-xl shadow-foreground/5"
      >
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3",
            open && "border-b border-border/70",
          )}
        >
          <Search
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
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
            }}
            placeholder="Search airports or filter with tags like #food #europe"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search airports"
            aria-expanded={open}
            aria-controls="airport-hero-search-list"
            role="combobox"
            className="h-8 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              onClick={clearQuery}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {activeTags.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {activeTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {open ? (
          <CommandList
            id="airport-hero-search-list"
            className="max-h-[min(24rem,calc(100vh-12rem))] p-2"
          >
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
                <CommandEmpty>No matching airports. Try another search or tag.</CommandEmpty>
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
