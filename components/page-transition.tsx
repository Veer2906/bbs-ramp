import { ViewTransition, type ReactNode } from "react";

/** Old page leaves fast, new page settles in. The classes are styled in globals.css. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      <div className="h-full">{children}</div>
    </ViewTransition>
  );
}
