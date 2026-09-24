import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

import { Button } from "./Button";
import { Field, Input } from "./Field";

import "./JayrrAuthPage.scss";

const ACCESS_EMAIL = "jayrrdev@gmail.com";
const ACCESS_MAILTO = `mailto:${ACCESS_EMAIL}?subject=${encodeURIComponent(
  "Jayrr beta access",
)}`;

const signInErrorMessage = (caught: unknown) => {
  const raw = caught instanceof Error ? caught.message : "";
  if (raw.includes("InviteOnly")) {
    return `Closed beta. Email ${ACCESS_EMAIL} for access.`;
  }
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
          formData.set("flow", "signIn");
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
        <div className="jayrr-auth__heading">
          <h1 className="jayrr-auth__title">Jayrr</h1>
          <p className="jayrr-auth__beta">Closed beta</p>
        </div>
        <Field label="Username">
          <Input
            autoComplete="username"
            autoFocus
            name="username"
            required
            type="text"
          />
        </Field>
        <Field label="Password">
          <Input
            autoComplete="current-password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </Field>
        {error ? <p className="jayrr-auth__error">{error}</p> : null}
        <Button busy={busy} fullWidth type="submit">
          Sign in
        </Button>
        <a className="jayrr-auth__access" href={ACCESS_MAILTO}>
          Need access? Email {ACCESS_EMAIL}
        </a>
      </form>
    </div>
  );
};
