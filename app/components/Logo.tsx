/* eslint-disable @next/next/no-img-element */

const SRC = {
  full: "/logo-sakanwave.svg", // icon + wordmark lockup
  icon: "/logo-icon.svg", // wave mark only, no wordmark — for tight spaces
} as const;

/** The SakanWave logo mark — an <img> reference (not inlined JSX) so the
 * exact original artwork renders unmodified; it's white, so it needs the
 * dark canvas behind it. */
export function Logo({
  height = 32,
  variant = "full",
  className,
}: {
  height?: number;
  variant?: keyof typeof SRC;
  className?: string;
}) {
  return (
    <img
      src={SRC[variant]}
      alt="SakanWave"
      height={height}
      style={{ height, width: "auto" }}
      className={className}
    />
  );
}
