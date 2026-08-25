import { Link, useLocation } from "@tanstack/react-router";
import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@taskome/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@taskome/ui/components/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@taskome/ui/components/sidebar";
import { ChevronRightIcon } from "lucide-react";

type MainNavItemData = {
  title: string;
  url?: string;
  icon: React.ReactNode;
  children?: { title: string; url: string }[];
};

function navigationLink(url: string) {
  return url === "/utilities/structure-viewer" ? (
    <Link to="/utilities/structure-viewer" />
  ) : (
    <a href={url} />
  );
}

function MainNavItem({ item, pathname }: { item: MainNavItemData; pathname: string }) {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const isActive = item.url !== "#" && item.url === pathname;

  if (item.children && isCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton tooltip={item.title} />}>
            {item.icon}
            <span>{item.title}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            aria-label={item.title}
            side="right"
            align="start"
            className="min-w-44"
          >
            {item.children.map((child) => (
              <DropdownMenuItem key={child.title} render={navigationLink(child.url)}>
                {child.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  if (item.children) {
    return (
      <SidebarMenuItem>
        <Collapsible className="group/collapsible">
          <CollapsibleTrigger render={<SidebarMenuButton tooltip={item.title} />}>
            {item.icon}
            <span>{item.title}</span>
            <ChevronRightIcon className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child) => (
                <SidebarMenuSubItem key={child.title}>
                  <SidebarMenuSubButton render={navigationLink(child.url)}>
                    <span>{child.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="relative"
        tooltip={item.title}
        isActive={isActive}
        render={
          item.url === "/" ? (
            <Link to="/" activeOptions={{ exact: true }} />
          ) : item.url === "/projects" || item.url === "/files" ? (
            <Link to={item.url} />
          ) : (
            <a href={item.url} />
          )
        }
      >
        {item.icon}
        {isActive ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 hidden w-0.5 rounded-r-full bg-sidebar-foreground group-data-[collapsible=icon]:block"
          />
        ) : null}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavMain({
  overview,
  sections,
}: {
  overview: MainNavItemData & { url: string };
  sections: {
    label: string;
    items: MainNavItemData[];
  }[];
}) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col">
        <SidebarMenu className="mb-4 group-data-[collapsible=icon]:mb-2">
          <MainNavItem item={overview} pathname={pathname} />
        </SidebarMenu>
        {sections.map((section, index) => (
          <div
            key={section.label}
            className={index === 0 ? undefined : "pt-4 group-data-[collapsible=icon]:pt-2"}
          >
            <SidebarGroupLabel
              id={`sidebar-${section.label.toLowerCase()}-label`}
              className="h-6 px-2 text-xs font-semibold tracking-wider uppercase group-data-[collapsible=icon]:-mt-6"
            >
              {section.label}
            </SidebarGroupLabel>
            <SidebarMenu aria-labelledby={`sidebar-${section.label.toLowerCase()}-label`}>
              {section.items.map((item) => (
                <MainNavItem key={item.title} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
