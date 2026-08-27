// Plain module (no "use client") so both the server (app/layout.tsx, via
// next/headers cookies()) and the client (lib/i18n.tsx) can import the
// actual string value — a named export from a "use client" file becomes an
// opaque client-reference stub when imported into server code, not the
// real value, which is why this constant can't live in lib/i18n.tsx itself.
export const LOCALE_COOKIE = "sakanwave-locale";
