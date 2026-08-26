import { buildIconResponse } from "@/lib/icon";

export const dynamic = "force-static";

export function GET() {
  return buildIconResponse(512, { maskable: true });
}
