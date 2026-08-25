const server = process.env.TASKOME_SERVER ?? "http://localhost:3000";
const email = `saved-file-smoke-${crypto.randomUUID()}@example.test`;
const password = "saved-file-smoke-password";

async function api(path: string, options: RequestInit = {}, cookie?: string) {
  const response = await fetch(new URL(path, server), {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
  if (!response.ok)
    throw new Error(
      `${options.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`,
    );
  return response;
}

const signUp = await api("/api/auth/sign-up/email", {
  body: JSON.stringify({ email, name: "Saved File smoke test", password }),
  method: "POST",
});
const cookie = signUp.headers.get("set-cookie")?.split(";", 1)[0];
if (!cookie) throw new Error("Sign-up returned no session cookie.");
const projects = await (await api("/api/v1/projects", {}, cookie)).json();
const project = projects.items[0];
if (!project) throw new Error("The smoke-test account has no Default Project.");
const bytes = "ATOM\nEND\n";
const issued = await (
  await api(
    "/api/v1/saved-files/uploads",
    {
      body: JSON.stringify({
        filename: "smoke.pdb",
        projectId: project.id,
        sizeBytes: bytes.length,
      }),
      method: "POST",
    },
    cookie,
  )
).json();
const uploaded = await fetch(issued.uploadUrl, {
  body: bytes,
  headers: { "content-length": String(bytes.length) },
  method: "PUT",
});
if (!uploaded.ok)
  throw new Error(`Object upload failed: ${uploaded.status} ${await uploaded.text()}`);
const download = await (
  await api(`/api/v1/saved-files/${issued.id}/download`, { method: "POST" }, cookie)
).json();
const downloaded = await (await fetch(download.downloadUrl)).text();
if (downloaded !== bytes) throw new Error("Downloaded bytes did not match the upload.");
console.log(`Saved File round trip succeeded: ${issued.id}`);
