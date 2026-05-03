import type { ReactNode } from "react";
import { type Role } from "@/lib/auth";
import { ProtectedRoute } from "./ProtectedRoute";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}
