export async function headers() {
  return new Headers({ cookie: "better-auth.session_token=session" });
}
