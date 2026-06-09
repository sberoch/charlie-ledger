import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../common/database/db";

export const auth = betterAuth({
  basePath: "/api/auth",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:3000"],
});
