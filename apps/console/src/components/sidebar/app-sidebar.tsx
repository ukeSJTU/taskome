import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { ModeToggle } from "@/components/common/mode-toggle";
import { NavMain } from "@/components/sidebar/nav-main";
import { NavUser, type NavUserData } from "@/components/sidebar/nav-user";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@taskome/ui/components/command";
import { Kbd } from "@taskome/ui/components/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@taskome/ui/components/sidebar";
import {
  ArrowLeftIcon,
  BoxesIcon,
  CommandIcon,
  FilesIcon,
  FolderIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PanelsTopLeftIcon,
  SearchIcon,
  ShieldCheckIcon,
  Settings2Icon,
  UserRoundIcon,
  WrenchIcon,
} from "lucide-react";

const data = {
  overview: {
    title: "Overview",
    url: "/",
    icon: <LayoutDashboardIcon />,
  },
  navMain: [
    {
      label: "Compute",
      items: [
        {
          title: "Tools",
          url: "#",
          icon: <WrenchIcon />,
        },
        {
          title: "Jobs",
          url: "#",
          icon: <ListChecksIcon />,
        },
        {
          title: "Batches",
          url: "#",
          icon: <BoxesIcon />,
        },
      ],
    },
    {
      label: "Workspace",
      items: [
        {
          title: "Projects",
          url: "#",
          icon: <FolderIcon />,
        },
        {
          title: "Files",
          url: "#",
          icon: <FilesIcon />,
        },
        {
          title: "Utilities",
          icon: <PanelsTopLeftIcon />,
          children: [
            { title: "Structure Viewer", url: "#" },
            { title: "MSA Viewer", url: "#" },
            { title: "Molecule Drawer", url: "#" },
          ],
        },
      ],
    },
  ],
};

type SettingsSection = "profile" | "security" | "api-keys" | undefined;

const settingsSections = [
  {
    label: "Account",
    items: [
      { title: "General", section: undefined, icon: <Settings2Icon /> },
      { title: "Profile", section: "profile", icon: <UserRoundIcon /> },
      { title: "Security", section: "security", icon: <ShieldCheckIcon /> },
    ],
  },
  {
    label: "Developer",
    items: [{ title: "API Keys", section: "api-keys", icon: <KeyRoundIcon /> }],
  },
] satisfies {
  label: string;
  items: { title: string; section: SettingsSection; icon: React.ReactNode }[];
}[];

function useCloseMobileSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();

  return React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
}

function SearchCommand() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const closeMobileSidebar = useCloseMobileSidebar();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((currentOpen) => !currentOpen);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigateToOverview = () => {
    setOpen(false);
    closeMobileSidebar();
    void navigate({ to: "/" });
  };

  const navigateToSettings = (section: SettingsSection) => {
    setOpen(false);
    closeMobileSidebar();
    void navigate({ to: "/settings/{-$section}", params: { section } });
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Search"
            className="border border-sidebar-border bg-sidebar-accent/50"
            onClick={() => setOpen(true)}
          >
            <SearchIcon />
            <span>Search</span>
            <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Taskome"
        description="Navigate to a page in Taskome."
      >
        <Command>
          <CommandInput placeholder="Search pages…" autoFocus />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            <CommandGroup heading="Taskome">
              <CommandItem onSelect={navigateToOverview}>
                <LayoutDashboardIcon />
                <span>Overview</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Settings">
              {settingsSections.flatMap((section) =>
                section.items.map((item) => (
                  <CommandItem
                    key={item.title}
                    value={`${section.label} ${item.title}`}
                    onSelect={() => navigateToSettings(item.section)}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </CommandItem>
                )),
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function SettingsLink() {
  const closeMobileSidebar = useCloseMobileSidebar();

  return (
    <SidebarGroup className="mt-auto pb-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              render={
                <Link
                  to="/settings/{-$section}"
                  params={{ section: undefined }}
                  onClick={closeMobileSidebar}
                />
              }
            >
              <Settings2Icon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: NavUserData }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu className="flex-row items-center">
          <SidebarMenuItem className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link to="/" />}
            >
              <CommandIcon />
              <span className="text-base font-semibold">Taskome</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="ml-auto">
            <SidebarTrigger />
          </SidebarMenuItem>
        </SidebarMenu>
        <SearchCommand />
      </SidebarHeader>
      <SidebarContent>
        <NavMain overview={data.overview} sections={data.navMain} />
        <SettingsLink />
        <ModeToggle />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

export function SettingsSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: NavUserData }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const closeMobileSidebar = useCloseMobileSidebar();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu className="flex-row items-center">
          <SidebarMenuItem className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="flex h-8 items-center px-2 text-base font-semibold">Settings</div>
          </SidebarMenuItem>
          <SidebarMenuItem className="ml-auto">
            <SidebarTrigger />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col">
            <SidebarMenu className="mb-4 group-data-[collapsible=icon]:mb-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Back to Taskome"
                  render={<Link to="/" onClick={closeMobileSidebar} />}
                >
                  <ArrowLeftIcon />
                  <span>Back to Taskome</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {settingsSections.map((section, index) => (
              <div
                key={section.label}
                className={index === 0 ? undefined : "pt-4 group-data-[collapsible=icon]:pt-2"}
              >
                <SidebarGroupLabel
                  id={`settings-${section.label.toLowerCase()}-label`}
                  className="h-6 px-2 text-xs font-semibold tracking-wider uppercase group-data-[collapsible=icon]:hidden"
                >
                  {section.label}
                </SidebarGroupLabel>
                <SidebarMenu aria-labelledby={`settings-${section.label.toLowerCase()}-label`}>
                  {section.items.map((item) => {
                    const href = item.section ? `/settings/${item.section}` : "/settings";

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={pathname === href}
                          render={
                            <Link
                              to="/settings/{-$section}"
                              params={{ section: item.section }}
                              onClick={closeMobileSidebar}
                            />
                          }
                        >
                          {item.icon}
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto">
          <ModeToggle />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
