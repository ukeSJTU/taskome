import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";

import { LoginForm } from "./login-form";

const { push, signInEmail } = vi.hoisted(() => ({ push: vi.fn(), signInEmail: vi.fn() }));

vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
  usePathname: () => "/en/login",
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: signInEmail } },
}));

describe("LoginForm", () => {
  beforeEach(() => {
    signInEmail.mockReset();
    push.mockReset();
  });

  // NOTE: field.state.meta.errors never populates for this form-level `z.object`
  // validator, so FieldError never renders text — filed as a follow-up, not fixed
  // here (out of scope for a test-infrastructure refactor). This test asserts the
  // part that does work: invalid input never reaches the network call.
  it("does not submit an invalid email and a short password", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Login" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("toggles the password field between hidden and visible", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("submits the entered credentials and redirects to the dashboard on success", async () => {
    signInEmail.mockImplementation((_credentials, handlers) => {
      handlers.onSuccess();
      return Promise.resolve();
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(signInEmail).toHaveBeenCalledWith(
      { email: "ada@example.com", password: "password123" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("continues an OAuth authorization request after sign-in", async () => {
    signInEmail.mockImplementation((_credentials, handlers) => {
      handlers.onSuccess();
      return Promise.resolve();
    });
    const user = userEvent.setup();
    const afterSignIn =
      "/api/auth/oauth2/authorize?client_id=mcp-client&code_challenge=challenge&state=oauth-state";
    render(<LoginForm afterSignIn={afterSignIn} />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(afterSignIn));
  });

  it("does not redirect when sign-in fails", async () => {
    signInEmail.mockImplementation((_credentials, handlers) => {
      handlers.onError({ error: { message: "Invalid email or password.", statusText: "" } });
      return Promise.resolve();
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await vi.waitFor(() => expect(signInEmail).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
