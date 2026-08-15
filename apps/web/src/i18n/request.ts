import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import englishMessages from "@messages/en.json";
import chineseMessages from "@messages/zh-CN.json";
import { routing } from "./routing";

const messagesByLocale = {
  en: englishMessages,
  "zh-CN": chineseMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
