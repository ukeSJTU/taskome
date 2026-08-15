import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";

import { SignupForm } from "./signup-form";

const { push, signUpEmail } = vi.hoisted(() => ({ push: vi.fn(), signUpEmail: vi.fn() }));

vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
  usePathname: () => "/en/signup",
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signUp: { email: signUpEmail } },
}));

describe("SignupForm", () => {
  beforeEach(() => {
    signUpEmail.mockReset();
    push.mockReset();
  });

  // See login-form.test.tsx: field-level errors don't render for this form-level
  // validator (a real gap, filed separately). This asserts what does work.
  it("does not submit a short name, an invalid email, and a short password", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Full Name"), "A");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("toggles the password field between hidden and visible", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("submits the entered details and redirects to the dashboard on success", async () => {
    signUpEmail.mockImplementation((_credentials, handlers) => {
      handlers.onSuccess();
      return Promise.resolve();
    });
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Full Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(signUpEmail).toHaveBeenCalledWith(
      { email: "ada@example.com", password: "password123", name: "Ada Lovelace" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("does not redirect when sign-up fails", async () => {
    signUpEmail.mockImplementation((_credentials, handlers) => {
      handlers.onError({ error: { message: "An account with this email already exists." } });
      return Promise.resolve();
    });
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Full Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await vi.waitFor(() => expect(signUpEmail).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
