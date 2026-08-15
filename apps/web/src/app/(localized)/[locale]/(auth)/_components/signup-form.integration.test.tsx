import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTestAuth } from "@/test/auth";
import { render, screen } from "@/test/render";

import { SignupForm } from "./signup-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
  usePathname: () => "/en/signup",
  useRouter: () => ({ push }),
}));

describe("SignupForm with the auth backend", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("creates an account and redirects to the dashboard", async () => {
    await useTestAuth();
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Full Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });
});
