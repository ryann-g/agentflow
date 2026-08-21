import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Source-assertion tests for the /reset-password page.
 *
 * Regression context: the login page's forgot-password flow sent reset
 * emails pointing at /reset-password, but no such route existed — users
 * clicking the email link landed on a 404 and could never set a new
 * password. These assertions pin the recovery flow end to end:
 *   - The page exists inside the (auth) group (noindex + centered chrome)
 *   - It exchanges the PKCE ?code= from the Supabase recovery email
 *   - It blocks form submission until a session exists
 *   - It updates the password via supabase.auth.updateUser
 *   - It offers a path back to /login on both success and failure
 *   - The login page's redirectTo actually targets /reset-password
 */

const PAGE_PATH = resolve(
  process.cwd(),
  "src/app/(auth)/reset-password/page.tsx"
);
const LOGIN_PATH = resolve(process.cwd(), "src/app/(auth)/login/page.tsx");

describe("/reset-password page (source assertions)", () => {
  it("exists as a route file", () => {
    expect(existsSync(PAGE_PATH)).toBe(true);
  });

  const source = existsSync(PAGE_PATH)
    ? readFileSync(PAGE_PATH, "utf8")
    : "";

  it("is a Client Component (needs state, effects, and Supabase browser client)", () => {
    expect(source.startsWith('"use client"')).toBe(true);
  });

  it("exchanges the PKCE code from the recovery email link", () => {
    expect(source).toContain("exchangeCodeForSession");
  });

  it("updates the password via supabase.auth.updateUser", () => {
    expect(source).toMatch(/auth\.updateUser\(\{\s*password/);
  });

  it("labels both password fields for accessibility", () => {
    expect(source).toMatch(/htmlFor="new-password"/);
    expect(source).toMatch(/htmlFor="confirm-password"/);
    expect(source).toMatch(/id="new-password"/);
    expect(source).toMatch(/id="confirm-password"/);
  });

  it("requires the password fields (no empty submission)", () => {
    expect(source).toMatch(/type="password"/);
    expect(source).toContain("required");
  });

  it("shows an error state with a way back to /login when there is no valid session", () => {
    expect(source).toMatch(/href="\/login"/);
    expect(source).toMatch(/role="alert"/);
  });

  it("shows a success state linking back to /login after update", () => {
    expect(source).toMatch(/succeeded|isSuccess|updateSuccess/);
    expect(source).toMatch(/href="\/login"/);
  });

  it("routes unauthenticated visitors to the login page via router.push", () => {
    expect(source).toMatch(/router\.push\(["'`]\/login/);
  });
});

describe("forgot-password redirectTo target (source assertions)", () => {
  const loginSource = readFileSync(LOGIN_PATH, "utf8");

  it("points the password-reset email at /reset-password", () => {
    expect(loginSource).toContain("/reset-password");
  });
});
