import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

import { Button } from "./Button";
import { Field, Input } from "./Field";

import "./JayrrAuthPage.scss";

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
              setError(
                caught instanceof Error ? caught.message : "Could not sign in",
              );
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
