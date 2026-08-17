"use client";

import * as React from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftIcon,
  BotIcon,
  DnaIcon,
  FilesIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  SearchIcon,
  Settings2Icon,
  WrenchIcon,
  WorkflowIcon,
} from "lucide-react";

import { NavMain } from "@/app/(application)/(app)/_components/nav-main";
import { NavSecondary } from "@/app/(application)/(app)/_components/nav-secondary";
import { NavSettings } from "@/app/(application)/(app)/_components/nav-settings";
import { NavTools } from "@/app/(application)/(app)/_components/nav-tools";
import { NavUser } from "@/app/(application)/(app)/_components/nav-user";
import type { SidebarNavItemData } from "@/app/(application)/(app)/_components/sidebar-nav-item";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@taskome/ui/components/sidebar";
import { Button } from "@taskome/ui/components/button";

import { SidebarCommandPalette } from "./sidebar-command-palette";

const mainNavigation: SidebarNavItemData[] = [
  { title: "Dashboard", href: "/dashboard", icon: <LayoutDashboardIcon /> },
  { title: "All Tools", href: "/tools", icon: <WrenchIcon /> },
  { title: "My Results", href: "/results", icon: <ListChecksIcon /> },
  { title: "Projects", icon: <FolderIcon />, disabled: true },
];

const toolNavigation: SidebarNavItemData[] = [
  { title: "Batch", icon: <FilesIcon />, disabled: true },
  { title: "Pipelines", icon: <WorkflowIcon />, disabled: true },
  { title: "Files", href: "/files", icon: <FolderIcon /> },
  { title: "AI Assistant", icon: <BotIcon />, disabled: true },
];

const secondaryNavigation: SidebarNavItemData[] = [
  { title: "Settings", href: "/settings", icon: <Settings2Icon /> },
];

const settingsNavigation: SidebarNavItemData[] = [
  { title: "General", href: "/settings/general", icon: <Settings2Icon /> },
  { title: "Usage", href: "/settings/usage", icon: <ListChecksIcon /> },
  { title: "API Keys", href: "/settings/api-keys", icon: <WrenchIcon /> },
  { title: "Notifications", icon: <BotIcon />, disabled: true },
  { title: "Security", icon: <DnaIcon />, disabled: true },
];

function SidebarBrand({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { state, toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center gap-1 overflow-hidden p-2">
      <SidebarMenuButton
        className="min-w-0 flex-1 data-[slot=sidebar-menu-button]:p-1.5"
        onClick={(event) => {
          if (state === "collapsed") {
            event.preventDefault();
            toggleSidebar();
          }
        }}
        render={<Link href="/dashboard" />}
        tooltip={state === "collapsed" ? "Expand sidebar" : undefined}
      >
        <DnaIcon className="size-5" />
        <span
          data-sidebar-header-motion
          className="text-sm font-semibold tracking-tight delay-100 transition-opacity duration-100 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:opacity-0"
        >
          taskome
        </span>
      </SidebarMenuButton>
      <div
        data-sidebar-header-motion
        className="flex shrink-0 gap-1 overflow-hidden delay-100 transition-[opacity,width] duration-100 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0"
      >
        <Button variant="ghost" size="icon-sm" aria-label="Search pages" onClick={onOpenPalette}>
          <SearchIcon />
          <span className="sr-only">Search pages</span>
        </Button>
        <SidebarTrigger aria-label="Collapse sidebar" />
      </div>
    </div>
  );
}

function BackToApp() {
  const { state } = useSidebar();

  return (
    <div className="px-2 pt-1">
      <SidebarMenuButton render={<Link href="/dashboard" />} tooltip="Back to App">
        <ArrowLeftIcon />
        <span className={state === "collapsed" ? "sr-only" : undefined}>Back to App</span>
      </SidebarMenuButton>
    </div>
  );
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
}) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const isSettingsMode = pathname === "/settings" || pathname?.startsWith("/settings/") === true;
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const previousLayer = React.useRef(isSettingsMode);
  const direction = previousLayer.current === isSettingsMode ? 0 : isSettingsMode ? 1 : -1;

  React.useEffect(() => {
    previousLayer.current = isSettingsMode;
  }, [isSettingsMode]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarBrand onOpenPalette={() => setPaletteOpen(true)} />
      <SidebarCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <SidebarContent className="overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={isSettingsMode ? "settings" : "app"}
            initial={{
              opacity: shouldReduceMotion ? 1 : 0,
              x: shouldReduceMotion ? 0 : direction * 16,
            }}
            animate={{ opacity: 1, x: 0 }}
            exit={{
              opacity: shouldReduceMotion ? 1 : 0,
              x: shouldReduceMotion ? 0 : direction * -16,
            }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
            className="flex min-h-full w-full flex-col"
          >
            {isSettingsMode ? (
              <>
                <BackToApp />
                <NavSettings items={settingsNavigation} />
              </>
            ) : (
              <>
                <NavMain items={mainNavigation} />
                <NavTools items={toolNavigation} />
                <NavSecondary items={secondaryNavigation} className="mt-auto" />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
