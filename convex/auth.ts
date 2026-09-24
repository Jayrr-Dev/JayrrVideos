import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

import type { DataModel } from "./_generated/dataModel";

const UsernamePassword = Password<DataModel>({
  profile(params) {
    if (String(params.flow ?? "") === "signUp") {
      throw new Error("InviteOnly");
    }
    const username = String(params.username ?? params.email ?? "").trim();
    if (!username) {
      throw new Error("Username is required");
    }
    return {
      email: username.toLowerCase(),
      name: username,
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [UsernamePassword],
});
