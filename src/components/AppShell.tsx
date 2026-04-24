import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground" style={{ background: "var(--app-page-bg, var(--color-background))" }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border px-4 backdrop-blur md:px-6"
          style={{
            background: "color-mix(in srgb, var(--app-header-bg, var(--color-background)) 88%, transparent)",
            color: "var(--app-header-foreground, var(--color-foreground))",
          }}
        >
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent/20"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <AppSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <h1 className="text-base font-semibold md:text-lg">{title}</h1>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
        <footer
          className="border-t border-border px-4 py-3 text-xs md:px-6"
          style={{
            background: "var(--app-footer-bg, var(--color-card))",
            color: "var(--app-footer-foreground, var(--color-foreground))",
          }}
        >
          J12 Sports · Painel central da operação
        </footer>
      </div>
    </div>
  );
}
