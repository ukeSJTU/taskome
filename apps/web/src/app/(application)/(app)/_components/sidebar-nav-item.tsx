"use client";

import type * as React from "react";

import type { Route } from "next";
import Link from "next/link";

import { Tooltip, TooltipContent, TooltipTrigger } from "@taskome/ui/components/tooltip";
import { SidebarMenuButton } from "@taskome/ui/components/sidebar";

export type SidebarNavItemData = {
  title: string;
  href?: Route;
  icon: React.ReactNode;
  disabled?: boolean;
};

export function SidebarNavItem({ item }: { item: SidebarNavItemData }) {
  if (item.disabled) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="block" />}>
          <SidebarMenuButton aria-disabled="true" className="pointer-events-none">
            {item.icon}
            <span>{item.title}</span>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent side="right">{item.title} is not available yet.</TooltipContent>
      </Tooltip>
    );
  }

  if (!item.href) {
    throw new Error(`Sidebar navigation item ${item.title} needs a destination.`);
  }

  return (
    <SidebarMenuButton render={<Link href={item.href} />} tooltip={item.title}>
      {item.icon}
      <span>{item.title}</span>
    </SidebarMenuButton>
  );
}
