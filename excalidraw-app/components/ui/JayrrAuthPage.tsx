import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

import { Button } from "./Button";
import { Field, Input } from "./Field";

import "./JayrrAuthPage.scss";

const signInErrorMessage = (caught: unknown) => {
  const raw = caught instanceof Error ? caught.message : "";
  if (raw.includes("InvalidSecret")) {
    return "Wrong password.";
  }
  if (raw.includes("InvalidAccountId")) {
    return "No account with that username.";
  }
  if (raw.includes("TooManyFailedAttempts")) {
    return "Too many tries. Wait a minute and try again.";
  }
  if (raw.includes("already exists")) {
    return "That username is already taken.";
  }
  return "Could not sign in.";
};

export const JayrrAuthPage = () => {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="jayrr-auth">
      <form
        className="jayrr-auth__card"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) {
            return;
          }
          const formData = new FormData(event.currentTarget);
          formData.set("flow", flow);
          setBusy(true);
          setError(null);
          void signIn("password", formData)
            .catch((caught: unknown) => {
              setError(signInErrorMessage(caught));
            })
            .finally(() => {
              setBusy(false);
            });
        }}
      >
        <h1 className="jayrr-auth__title">Jayrr</h1>
        <Field label="Username">
          <Input
            autoComplete="username"
            autoFocus
            defaultValue="Jayrr"
            name="username"
            required
            type="text"
          />
        </Field>
        <Field label="Password">
          <Input
            autoComplete={
              flow === "signIn" ? "current-password" : "new-password"
            }
            minLength={8}
            name="password"
            required
            type="password"
          />
        </Field>
        {error ? <p className="jayrr-auth__error">{error}</p> : null}
        <Button busy={busy} fullWidth type="submit">
          {flow === "signIn" ? "Sign in" : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null);
            setFlow(flow === "signIn" ? "signUp" : "signIn");
          }}
        >
          {flow === "signIn" ? "Create an account" : "Have an account? Sign in"}
        </Button>
      </form>
    </div>
  );
};
