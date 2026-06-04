import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useI18n();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K: Open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Ctrl+N or Cmd+N: Open new task dialog (managers only)
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        if (role === "admin" || role === "manager") {
          // This would need to be wired to the actual dialog
          toast.info(t("shortcut_new_task") || "Ctrl+N: New task dialog");
        }
      }

      // Ctrl+I or Cmd+I: Toggle check-in/out (employees only)
      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        if (role === "employee") {
          toast.info(t("shortcut_check_in") || "Ctrl+I: Toggle check-in");
        }
      }

      // Escape: Close any open dialog
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    },
    [role, navigate, t]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { commandPaletteOpen, setCommandPaletteOpen };
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setSearch("");
      // Load tasks and employees for search
      const loadItems = async () => {
        const { supabase } = await import("@/integrations/supabase/client");
        const [tasksRes, profilesRes] = await Promise.all([
          supabase.from("tasks").select("id, title").limit(50),
          supabase.from("profiles").select("id, full_name").limit(50),
        ]);
        const allItems = [
          ...(tasksRes.data?.map((t) => ({ type: "task", id: t.id, label: t.title })) || []),
          ...(profilesRes.data?.map((p) => ({ type: "employee", id: p.id, label: p.full_name })) || []),
          { type: "page", id: "dashboard", label: t("dashboard") },
          { type: "page", id: "tasks", label: t("tasks") },
          { type: "page", id: "attendance", label: t("attendance") },
        ];
        setItems(allItems);
      };
      loadItems();
    }
  }, [open, t]);

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (item: any) => {
    onOpenChange(false);
    if (item.type === "task") {
      navigate({ to: "/", search: { task_id: item.id } as any });
    } else if (item.type === "employee") {
      navigate({ to: "/", search: { employee_id: item.id } as any });
    } else if (item.type === "page") {
      navigate({ to: "/" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle>{t("search") || "بحث"}</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <Input
            placeholder={t("search_placeholder") || "ابحث عن مهام، موظفين..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
            autoFocus
          />
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filteredItems.map((item, i) => (
              <button
                key={`${item.type}-${item.id}-${i}`}
                onClick={() => handleSelect(item)}
                className="w-full text-start px-3 py-2 rounded hover:bg-accent text-sm transition-colors"
              >
                <span className="text-muted-foreground text-xs me-2">{item.type === "task" ? "📋" : item.type === "employee" ? "👤" : "📄"}</span>
                {item.label}
              </button>
            ))}
            {filteredItems.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">
                {t("no_results_found")}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
