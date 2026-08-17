"use client";

import * as React from "react";

import type { Route } from "next";
import Link from "next/link";
import { ChevronDownIcon, EyeIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@taskome/ui/components/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@taskome/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@taskome/ui/components/sidebar";

import { SidebarNavItem, type SidebarNavItemData } from "./sidebar-nav-item";

const viewerItems: { title: string; href: Route }[] = [
  { title: "Structure Viewer", href: "/viewers/structure" },
  { title: "MSA Viewer", href: "/viewers/msa" },
  { title: "Molecule Drawer", href: "/viewers/molecule-drawer" },
];

function ViewersMenu() {
  const { isMobile, state } = useSidebar();

  if (state === "collapsed" && !isMobile) {
    return <ViewersFlyout />;
  }

  return (
    <Collapsible>
      <SidebarMenuItem>
        <SidebarMenuButton render={<CollapsibleTrigger />} tooltip="Viewers">
          <EyeIcon />
          <span>Viewers</span>
          <ChevronDownIcon className="ml-auto transition-transform data-[panel-open]:rotate-180" />
        </SidebarMenuButton>
        <CollapsibleContent>
          <SidebarMenuSub>
            {viewerItems.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton render={<Link href={item.href} />}>
                  <span>{item.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function ViewersFlyout() {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const keepOpen = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  React.useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<SidebarMenuButton tooltip="Viewers" />}
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
      >
        <EyeIcon />
        <span>Viewers</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
      >
        {viewerItems.map((item) => (
          <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
            {item.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavTools({ items }: { items: SidebarNavItemData[] }) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.slice(0, 3).map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarNavItem item={item} />
          </SidebarMenuItem>
        ))}
        <ViewersMenu />
        {items.slice(3).map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarNavItem item={item} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
