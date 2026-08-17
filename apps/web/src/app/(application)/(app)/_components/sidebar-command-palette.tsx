"use client";

import * as React from "react";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@taskome/ui/components/command";
import { Dialog, DialogContent, DialogTitle } from "@taskome/ui/components/dialog";
import { useSidebar } from "@taskome/ui/components/sidebar";

type PaletteRoute = {
  title: string;
  href?: Route;
  keywords: string[];
  disabled?: boolean;
};

const routeGroups: { heading: string; items: PaletteRoute[] }[] = [
  {
    heading: "App",
    items: [
      { title: "Dashboard", href: "/dashboard", keywords: ["home"] },
      { title: "All Tools", href: "/tools", keywords: ["tasks"] },
      { title: "My Results", href: "/results", keywords: ["jobs", "outputs"] },
      { title: "Projects", keywords: [], disabled: true },
    ],
  },
  {
    heading: "Tools",
    items: [
      { title: "Batch", keywords: [], disabled: true },
      { title: "Pipelines", keywords: [], disabled: true },
      { title: "Files", href: "/files", keywords: ["input", "uploads"] },
      { title: "AI Assistant", keywords: [], disabled: true },
    ],
  },
  {
    heading: "Viewers",
    items: [
      { title: "PDB Viewer", href: "/viewers/pdb", keywords: ["protein", "structure"] },
      { title: "MSA Viewer", href: "/viewers/msa", keywords: ["alignment", "sequence"] },
      {
        title: "Molecule Drawer",
        href: "/viewers/molecule-drawer",
        keywords: ["chemical", "sketch"],
      },
    ],
  },
  {
    heading: "Settings",
    items: [
      { title: "General", href: "/settings/general", keywords: ["preferences"] },
      { title: "Usage", href: "/settings/usage", keywords: ["billing"] },
      { title: "API Keys", href: "/settings/api-keys", keywords: ["tokens", "credentials"] },
      { title: "Notifications", keywords: [], disabled: true },
      { title: "Security", keywords: [], disabled: true },
    ],
  },
];

export function SidebarCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  const selectRoute = (item: PaletteRoute) => {
    if (item.disabled || !item.href) return;

    onOpenChange(false);
    if (isMobile) setOpenMobile(false);
    if (pathname !== item.href) router.push(item.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Search pages</DialogTitle>
        <Command label="Search pages" loop>
          <CommandInput placeholder="Search pages..." aria-label="Search pages" />
          <CommandList>
            <CommandEmpty>No matching pages found.</CommandEmpty>
            {routeGroups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map((item) => {
                  const current = item.href === pathname;
                  return (
                    <CommandItem
                      key={item.title}
                      value={item.title}
                      keywords={item.keywords}
                      disabled={item.disabled}
                      aria-disabled={item.disabled || undefined}
                      onSelect={() => selectRoute(item)}
                    >
                      <span className="flex-1">{item.title}</span>
                      {current && <CheckIcon aria-label="Current page" className="size-4" />}
                      {item.disabled && (
                        <span className="text-xs text-muted-foreground">Coming soon</span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
