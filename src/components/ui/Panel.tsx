import type { HTMLAttributes } from "react";

/** Glass wrapper used for boards, controls, and history. */
export function Panel({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass p-4 sm:p-6 ${className}`} {...rest} />;
}
