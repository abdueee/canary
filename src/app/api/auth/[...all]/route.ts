import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Exposes Better Auth's endpoints (sign-up, sign-in, sign-out, get-session, ...)
// under /api/auth/*. The auth client in the browser talks to these.
export const { GET, POST } = toNextJsHandler(auth);
