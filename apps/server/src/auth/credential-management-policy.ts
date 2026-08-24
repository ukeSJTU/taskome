export const freshSessionSeconds = 60 * 15;

export type CredentialManagementDenial = "email_verification_required" | "fresh_session_required";

export function credentialManagementDenial(input: {
  emailVerified: boolean;
  now?: number;
  sessionCreatedAt: Date;
}): CredentialManagementDenial | null {
  if (!input.emailVerified) return "email_verification_required";
  if ((input.now ?? Date.now()) - input.sessionCreatedAt.getTime() > freshSessionSeconds * 1000) {
    return "fresh_session_required";
  }
  return null;
}
