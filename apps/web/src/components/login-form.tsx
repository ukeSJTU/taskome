"use client";

import { useForm } from "@tanstack/react-form";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { Button } from "@taskome/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@taskome/ui/components/field";
import { Input } from "@taskome/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@taskome/ui/components/input-group";
import { cn } from "@taskome/ui/lib/utils";

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function LoginForm({ className, ...props }: React.ComponentProps<"form">) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => setIsHydrated(true), []);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            // TODO: honor a callbackUrl query param instead of always redirecting to /dashboard
            router.push("/dashboard");
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: loginSchema,
    },
  });

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      data-hydrated={isHydrated || undefined}
      data-testid="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>

        <form.Field name="email">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                placeholder="m@example.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id={field.name}
                  name={field.name}
                  type={showPassword ? "text" : "password"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <Field>
          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Signing in..." : "Login"}
              </Button>
            )}
          </form.Subscribe>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline underline-offset-4">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
