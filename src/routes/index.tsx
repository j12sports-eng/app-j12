import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Toaster } from "react-hot-toast";

import { getRoleHomePath, useAuth } from "@/lib/auth";

import "@/lib/socket";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <Toaster position="top-right" />

        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <Navigate to="/login" />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <Navigate to={getRoleHomePath(user)} />
    </>
  );
}
