"use client";

import dynamic from "next/dynamic";

export const InstallButton = dynamic(
  () => import("./InstallButtonClient").then((m) => m.InstallButtonClient),
  { ssr: false }
);
