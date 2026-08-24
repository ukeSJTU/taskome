export interface ProtectedResources {
  mcp: string;
  rest: string;
}

export function protectedResources(serverOrigin: string): ProtectedResources {
  const origin = new URL(serverOrigin).origin;
  return {
    mcp: `${origin}/mcp`,
    rest: `${origin}/api/v1`,
  };
}
