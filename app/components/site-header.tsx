"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { AirportSearchPalette } from "@/app/components/airport-hero-search";
import { Button } from "@/components/ui/button";
import type { Airport } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface SiteHeaderProps {
  airports: Airport[];
}

export function SiteHeader({ airports }: SiteHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function openSearch() {
    setMenuOpen(false);
    setSearchOpen(true);
  }

  return (
    <>
      <div className="ml-auto flex items-center gap-1">
        <nav className="mr-1 hidden items-center md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Directory</Link>
          </Button>
        </nav>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Search airports"
          onClick={() => setSearchOpen(true)}
        >
          <Search />
        </Button>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-1 px-4">
              <SheetClose asChild>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/">Airport directory</Link>
                </Button>
              </SheetClose>
            </nav>

            <Separator className="my-2" />

            <div className="px-4 pb-4">
              <Button variant="outline" className="w-full justify-start" onClick={openSearch}>
                <Search className="size-4" aria-hidden="true" />
                Search airports
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AirportSearchPalette
        airports={airports}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </>
  );
}
