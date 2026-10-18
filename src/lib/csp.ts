/**
 * Content-Security-Policy for the static export.
 *
 * Delivered via `<meta http-equiv>` because GitHub Pages cannot set custom
 * response headers. `frame-ancestors` is ignored in a meta policy, and
 * Permissions-Policy has no meta equivalent — callers should not pretend
 * either is enforced.
 *
 * `next/font` self-hosts faces at build time, so fonts stay on `'self'`.
 * Inline bootstrap scripts from the App Router still need `'unsafe-inline'`.
 * `'unsafe-eval'` is limited to the dev server (React's error overlay).
 */
export function contentSecurityPolicy(nodeEnv: string | undefined = process.env.NODE_ENV): string {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (nodeEnv !== "production") scriptSrc.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Event-handler attributes fall back to script-src when this is absent.
    // Next does not emit them; keep inline <script> blocks via script-src only.
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
  ].join("; ");
}
