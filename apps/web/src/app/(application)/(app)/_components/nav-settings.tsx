"use client";

import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@taskome/ui/components/sidebar";

import { SidebarNavItem, type SidebarNavItemData } from "./sidebar-nav-item";

export function NavSettings({ items }: { items: SidebarNavItemData[] }) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarNavItem item={item} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
