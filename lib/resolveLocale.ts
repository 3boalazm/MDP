import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "./localeCookie";
import type { Locale } from "./i18n";

/** Server-side locale read (from the same cookie the client toggle writes),
 * shared by the root layout and every page's generateMetadata so each
 * route's title/description render correctly on first paint, in the
 * visitor's saved language, without waiting for client JS to correct it. */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "ar";
}
