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
  organization: {
    email: "contact@xdenovoai.com",
    phone: {
      display: "+86 183 5485 8296",
      href: "tel:+8618354858296",
      structuredValue: "+86-183-5485-8296",
    },
    address: {
      line1: "Room 402, Building 5",
      line2: "396 Lvzhou Ring Road",
      cityLine: "Minhang, Shanghai, China",
      streetAddress: "Room 402, Building 5, 396 Lvzhou Ring Road",
      locality: "Shanghai",
      region: "Minhang District",
      country: "CN",
    },
  },
  origins,
  links: {
    docs: new URL("/", origins.docs).toString(),
    signIn: new URL("/login", origins.console).toString(),
  },
} as const;
