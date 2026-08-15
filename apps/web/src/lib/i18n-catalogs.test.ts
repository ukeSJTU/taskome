import { parse } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

import english from "../../messages/en.json";
import simplifiedChinese from "../../messages/zh-CN.json";

function flattenMessages(value: unknown, prefix = ""): Map<string, string> {
  const messages = new Map<string, string>();

  if (typeof value === "string") {
    messages.set(prefix, value);
    return messages;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Message at ${prefix || "<root>"} must be a string or object`);
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPrefix = prefix ? `${prefix}.${key}` : key;
    for (const [nestedKey, message] of flattenMessages(nestedValue, nestedPrefix)) {
      messages.set(nestedKey, message);
    }
  }

  return messages;
}

describe("locale catalogs", () => {
  const catalogs = {
    en: flattenMessages(english),
    "zh-CN": flattenMessages(simplifiedChinese),
  };

  it("keeps every locale structurally identical to the English source catalog", () => {
    expect([...catalogs["zh-CN"].keys()].sort()).toEqual([...catalogs.en.keys()].sort());
  });

  it.each(Object.entries(catalogs))("contains valid ICU messages in %s", (_locale, messages) => {
    for (const [key, message] of messages) {
      expect(() => parse(message), `${key}: ${message}`).not.toThrow();
    }
  });
});
