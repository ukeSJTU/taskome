const localOrigins = {
  console: "http://localhost:3001",
  docs: "http://localhost:4000",
  web: "http://localhost:3002",
} as const;

function readOrigin(value: string | undefined, fallback: string, variableName: string) {
  if (!value) {
    return new URL(fallback);
  }

  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${variableName} must use http or https.`);
  }

  return new URL(url.origin);
}

const origins = {
  console: readOrigin(
    process.env.TASKOME_CONSOLE_ORIGIN,
    localOrigins.console,
    "TASKOME_CONSOLE_ORIGIN",
  ),
  docs: readOrigin(process.env.TASKOME_DOCS_ORIGIN, localOrigins.docs, "TASKOME_DOCS_ORIGIN"),
  web: readOrigin(process.env.XDENOVO_WEB_ORIGIN, localOrigins.web, "XDENOVO_WEB_ORIGIN"),
};

export const siteConfig = {
  name: "XDenovo",
  origins,
  links: {
    docs: new URL("/", origins.docs).toString(),
    signIn: new URL("/login", origins.console).toString(),
  },
} as const;
