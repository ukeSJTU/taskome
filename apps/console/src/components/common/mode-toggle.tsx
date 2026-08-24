import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@taskome/ui/components/dropdown-menu";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@taskome/ui/components/sidebar";
import { ChevronRightIcon, SunMoonIcon } from "lucide-react";

import { useTheme } from "@/components/common/theme-provider";

export function ModeToggle() {
  const { isMobile } = useSidebar();
  const { setTheme, theme } = useTheme();
  const currentTheme = theme === "light" || theme === "dark" ? theme : "system";
  const currentThemeLabel =
    currentTheme === "light" ? "Light" : currentTheme === "dark" ? "Dark" : "System";

  return (
    <SidebarGroup className="pt-0">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton tooltip="Appearance" className="pr-2" />}
            >
              <SunMoonIcon />
              <span>Appearance</span>
              <span className="ml-auto text-xs text-sidebar-foreground/60">
                {currentThemeLabel}
              </span>
              <ChevronRightIcon className="text-sidebar-foreground/50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isMobile ? "bottom" : "right"}
              align={isMobile ? "end" : "start"}
            >
              <DropdownMenuRadioGroup value={currentTheme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
