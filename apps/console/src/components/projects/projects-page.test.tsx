import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";

import type { Project } from "@/api/generated/models";
import { ProjectsPage } from "./projects-page";

const timestamp = "2026-08-24T00:00:00.000Z";
const defaultProject: Project = {
  archivedAt: null,
  createdAt: timestamp,
  description: null,
  id: "00000000-0000-4000-8000-000000000001",
  isDefault: true,
  name: "Default Project",
  status: "active",
  updatedAt: timestamp,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function projectApi(initialProjects: Project[]) {
  let projects = structuredClone(initialProjects);

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";

    if (url.pathname === "/api/v1/projects" && method === "GET") {
      return jsonResponse({ items: projects, nextCursor: null });
    }

    if (url.pathname === "/api/v1/projects" && method === "POST") {
      const body = z
        .object({ description: z.string().nullable().optional(), name: z.string() })
        .parse(JSON.parse(String(init?.body)));
      const created: Project = {
        archivedAt: null,
        createdAt: timestamp,
        description: body.description ?? null,
        id: "00000000-0000-4000-8000-000000000002",
        isDefault: false,
        name: body.name,
        status: "active",
        updatedAt: timestamp,
      };
      projects = [...projects, created];
      return jsonResponse(created, 201);
    }

    const projectId = url.pathname.split("/")[4];
    const current = projects.find((project) => project.id === projectId);
    if (!current) return jsonResponse({ detail: "Project not found" }, 404);

    if (url.pathname.endsWith("/archive") && method === "POST") {
      const archived: Project = { ...current, archivedAt: timestamp, status: "archived" };
      projects = projects.map((project) => (project.id === projectId ? archived : project));
      return jsonResponse(archived);
    }

    if (url.pathname.endsWith("/unarchive") && method === "POST") {
      const restored: Project = { ...current, archivedAt: null, status: "active" };
      projects = projects.map((project) => (project.id === projectId ? restored : project));
      return jsonResponse(restored);
    }

    throw new Error(`Unexpected Project API request: ${method} ${url.pathname}`);
  });
}

function renderProjects(projects: Project[]) {
  vi.stubGlobal("fetch", projectApi(projects));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <ProjectsPage />
      </QueryClientProvider>,
    ),
  };
}

async function openActions(user: ReturnType<typeof userEvent.setup>, name: string) {
  const trigger = await screen.findByRole("button", { name: `Actions for ${name}` });
  trigger.focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("menu", { name: `Actions for ${name}` });
}

afterEach(() => vi.unstubAllGlobals());

test("creates, archives, and restores a Project while protecting Default Project actions", async () => {
  const { user } = renderProjects([defaultProject]);

  expect(await screen.findByText("Default Project")).toBeDefined();
  await openActions(user, "Default Project");
  expect(screen.getByRole("menuitem", { name: "Edit" })).toBeDefined();
  expect(screen.queryByRole("menuitem", { name: "Archive" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Delete permanently" })).toBeNull();
  await user.keyboard("{Escape}");

  const createButton = screen.getAllByRole("button", { name: "Create project" })[0];
  if (!createButton) throw new Error("Projects page did not render its create action");
  await user.click(createButton);
  const createDialog = screen.getByRole("dialog", { name: "Create project" });
  const nameInput = within(createDialog).getByLabelText("Name");
  const descriptionInput = within(createDialog).getByLabelText("Description");
  const unicodeText = "🧬".repeat(51);
  await user.type(nameInput, unicodeText);
  await user.type(descriptionInput, unicodeText);
  expect(nameInput).toHaveProperty("value", unicodeText);
  expect(descriptionInput.getAttribute("maxlength")).toBeNull();
  expect(within(createDialog).getByText("Optional · 51/1000 characters")).toBeDefined();
  await user.clear(nameInput);
  await user.clear(descriptionInput);
  await user.type(nameInput, "Protein Design");
  await user.type(descriptionInput, "Protein design study");
  await user.click(within(createDialog).getByRole("button", { name: "Create project" }));

  expect(await screen.findByText("Protein Design")).toBeDefined();
  await openActions(user, "Protein Design");
  await user.click(screen.getByRole("menuitem", { name: "Archive" }));
  expect(await screen.findByRole("heading", { name: "Archived" })).toBeDefined();

  await openActions(user, "Protein Design");
  expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
  await user.click(screen.getByRole("menuitem", { name: "Restore" }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Archived" })).toBeNull());
});

test("explains the empty-only, non-migrating delete rule before deletion", async () => {
  const regularProject: Project = {
    ...defaultProject,
    id: "00000000-0000-4000-8000-000000000002",
    isDefault: false,
    name: "Disposable",
  };
  const { user } = renderProjects([defaultProject, regularProject]);

  await openActions(user, "Disposable");
  await user.click(screen.getByRole("menuitem", { name: "Delete permanently" }));

  const dialog = screen.getByRole("alertdialog", {
    name: "Delete “Disposable” permanently?",
  });
  expect(
    within(dialog).getByText(
      /Only an empty project can be deleted\. Taskome will never move or delete its jobs and files automatically\./,
    ),
  ).toBeDefined();
});
