import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import englishMessages from "@messages/en.json";
import chineseMessages from "@messages/zh-CN.json";

import { LanguageSwitcher } from "./language-switcher";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    locale,
    ...props
  }: Omit<ComponentProps<"a">, "href"> & {
    href: string | { pathname: string; query: object };
    locale: string;
  }) => {
    const pathname = typeof href === "string" ? href : href.pathname;
    const query = typeof href === "string" ? undefined : href.query;
    return <a href={pathname} data-locale={locale} data-query={JSON.stringify(query)} {...props} />;
  },
  usePathname: () => "/technology",
  useRouter: () => ({ replace }),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState({}, "", "/technology?client_id=agent&scope=taskome");
  });

  it.each([
    ["en", englishMessages, "zh-CN", "切换到中文"],
    ["zh-CN", chineseMessages, "en", "切换到英文"],
  ] as const)(
    "keeps the current pathname when switching from %s",
    (locale, messages, target, label) => {
      render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LanguageSwitcher />
        </NextIntlClientProvider>,
      );

      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", "/technology");
      expect(link).toHaveAttribute("data-locale", target);
      link.click();
      expect(replace).toHaveBeenCalledWith(
        {
          pathname: "/technology",
          query: { client_id: "agent", scope: "taskome" },
        },
        { locale: target },
      );
    },
  );
});
