import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Download, Search, Calendar, Filter, Clock, ChevronLeft, ChevronRight, ArrowDownUp, User } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 20;

type AttendanceEvent = {
  id: string;
  user_id: string;
  event_type: string;
  reason?: string;
  event_at: string;
  event_date: string;
  exit_request_id?: string;
};

function eventTypeBadge(eventType: string, t: (k: string) => string) {
  switch (eventType) {
    case "in":
      return <Badge className="bg-success/15 text-success">{t("check_in") || "دخول"}</Badge>;
    case "out":
      return <Badge className="bg-warning/15 text-warning">{t("check_out") || "خروج"}</Badge>;
    case "out_final":
      return <Badge className="bg-danger/15 text-danger">{t("day_end") || "نهاية اليوم"}</Badge>;
    default:
      return <Badge variant="secondary">{eventType}</Badge>;
  }
}

export function AttendancePage() {
  const { t, dir } = useI18n();
  const { user } = useAuth();

  const [searchName, setSearchName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").order("event_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data as AttendanceEvent[];
    },
    staleTime: 60_000,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, department_id");
      if (error) throw error;
      return data as any[];
    },
    staleTime: 60_000,
  });

  const profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("departments").select("id, name_ar, name_en");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const deptMap = Object.fromEntries((departments ?? []).map((d: any) => [d.id, d.name_ar || d.name_en]));

  const filtered = useMemo(() => {
    let rows = attendance ?? [];

    if (searchName) {
      const q = searchName.toLowerCase();
      rows = rows.filter((a) => {
        const name = profilesMap[a.user_id]?.full_name?.toLowerCase() || "";
        return name.includes(q);
      });
    }

    if (dateFrom) {
      rows = rows.filter((a) => a.event_date >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((a) => a.event_date <= dateTo);
    }

    if (statusFilter !== "all") {
      rows = rows.filter((a) => (a.event_type as string) === statusFilter);
    }

    return rows;
  }, [attendance, searchName, dateFrom, dateTo, statusFilter, profilesMap]);

  const grouped = useMemo(() => {
    const map = new Map<string, { userId: string; date: string; events: AttendanceEvent[] }>();
    for (const a of filtered) {
      const key = `${a.user_id}_${a.event_date}`;
      if (!map.has(key)) {
        map.set(key, { userId: a.user_id, date: a.event_date, events: [] });
      }
      map.get(key)!.events.push(a);
    }
    return Array.from(map.values()).sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (profilesMap[a.userId]?.full_name || "").localeCompare(profilesMap[b.userId]?.full_name || "");
    });
  }, [filtered, profilesMap]);

  const totalPages = Math.ceil(grouped.length / PAGE_SIZE);
  const pageData = grouped.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const selectedDayEvents = useMemo(() => {
    if (!selectedUserId || !selectedDate) return [];
    return (attendance ?? [])
      .filter((a) => a.user_id === selectedUserId && a.event_date === selectedDate)
      .sort((a, b) => a.event_at.localeCompare(b.event_at));
  }, [attendance, selectedUserId, selectedDate]);

  const daySummary = useMemo(() => {
    let inOffice = 0;
    let outside = 0;
    const events = selectedDayEvents;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const evType = ev.event_type as string;
      if (evType === "out" || evType === "out_final") {
        const prevIn = events.slice(0, i).reverse().find((e) => (e.event_type as string) === "in");
        if (prevIn) {
          const diff = (new Date(ev.event_at).getTime() - new Date(prevIn.event_at).getTime()) / 3600000;
          inOffice += diff;
        }
      }
      if (evType === "in" && i > 0) {
        const prevOut = events.slice(0, i).reverse().find((e) => (e.event_type as string) === "out");
        if (prevOut) {
          const diff = (new Date(ev.event_at).getTime() - new Date(prevOut.event_at).getTime()) / 3600000;
          outside += diff;
        }
      }
    }
    return { inOffice: Math.round(inOffice * 10) / 10, outside: Math.round(outside * 10) / 10, exitCount: events.filter((e) => (e.event_type as string) === "out").length };
  }, [selectedDayEvents]);

  const exportAttendance = () => {
    const rows = [
      [t("name"), t("event_type") || "الحدث", t("reason"), t("date"), t("time")],
      ...filtered.map((a: any) => [
        profilesMap[a.user_id]?.full_name ?? "",
        a.event_type,
        a.reason ?? "",
        a.event_date,
        new Date(a.event_at).toLocaleTimeString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 bg-muted rounded animate-pulse" />
        <div className="h-64 w-full bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-primary">{t("attendance_log") || "سجل الحضور"}</h1>
        <Button variant="outline" onClick={exportAttendance}>
          <Download className="h-4 w-4 me-1" />
          {t("export_csv") || "تصدير CSV"}
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground mb-1 block">{t("search_name") || "بحث بالاسم"}</label>
            <div className="relative">
              <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("search_name") || "بحث بالاسم"}
                value={searchName}
                onChange={(e) => { setSearchName(e.target.value); setPage(0); }}
                className="ps-8"
              />
            </div>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">{t("from_date") || "من تاريخ"}</label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">{t("to_date") || "إلى تاريخ"}</label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">{t("status") || "الحالة"}</label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all") || "الكل"}</SelectItem>
                <SelectItem value="in">{t("in_office") || "في المكتب"}</SelectItem>
                <SelectItem value="out">{t("outside") || "خارج"}</SelectItem>
                <SelectItem value="out_final">{t("day_end") || "نهاية اليوم"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("first_check_in") || "أول دخول"}</TableHead>
              <TableHead>{t("last_event") || "آخر حدث"}</TableHead>
              <TableHead>{t("exit_count") || "طلبات الخروج"}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <EmptyState
                    icon={<Calendar className="h-12 w-12 text-muted-foreground/50" />}
                    title={t("no_data")}
                    description={t("no_attendance_desc") || "لا توجد سجلات حضور"}
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row) => {
                const firstIn = row.events.find((e) => (e.event_type as string) === "in");
                const lastEv = row.events[row.events.length - 1];
                const exitCount = row.events.filter((e) => (e.event_type as string) === "out").length;
                const lastType = lastEv?.event_type as string;
                let statusLabel = t("not_checked_in") || "لم يسجل";
                let statusClass = "bg-gray-200 text-gray-600";
                if (lastType === "in") { statusLabel = t("in_office") || "في المكتب"; statusClass = "bg-success/15 text-success"; }
                else if (lastType === "out") { statusLabel = t("outside") || "خارج"; statusClass = "bg-warning/15 text-warning"; }
                else if (lastType === "out_final") { statusLabel = t("day_ended") || "انتهى اليوم"; statusClass = "bg-danger/15 text-danger"; }

                return (
                  <TableRow
                    key={`${row.userId}_${row.date}`}
                    className="cursor-pointer hover:bg-accent/5"
                    onClick={() => { setSelectedUserId(row.userId); setSelectedDate(row.date); }}
                  >
                    <TableCell className="font-medium">{profilesMap[row.userId]?.full_name || "—"}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{firstIn ? new Date(firstIn.event_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell>{lastEv ? new Date(lastEv.event_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell>{exitCount}</TableCell>
                    <TableCell><Badge className={statusClass}>{statusLabel}</Badge></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {dir === "rtl" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            {dir === "rtl" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <Sheet open={!!selectedUserId && !!selectedDate} onOpenChange={(open) => { if (!open) { setSelectedUserId(null); setSelectedDate(null); } }}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedUserId && profilesMap[selectedUserId]?.full_name} — {selectedDate}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">{t("daily_timeline") || "تفاصيل اليوم"}</h3>
              {selectedDayEvents.map((ev, i) => {
                const evType = ev.event_type as string;
                let dotColor = "bg-success";
                let label = t("check_in") || "دخول";
                if (evType === "out") { dotColor = "bg-warning"; label = t("check_out") || "خروج"; }
                else if (evType === "out_final") { dotColor = "bg-danger"; label = t("day_end") || "نهاية اليوم"; }

                return (
                  <div key={ev.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${dotColor} shrink-0`} />
                      {i < selectedDayEvents.length - 1 && <div className="w-0.5 h-8 bg-border" />}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-medium">
                        {new Date(ev.event_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {label}
                      </p>
                      {ev.reason && <p className="text-xs text-muted-foreground mt-0.5">{ev.reason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{daySummary.inOffice}h</p>
                <p className="text-xs text-muted-foreground">{t("hours_in_office") || "ساعات في المكتب"}</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-warning">{daySummary.outside}h</p>
                <p className="text-xs text-muted-foreground">{t("hours_outside") || "ساعات خارج المكتب"}</p>
              </Card>
              <Card className="p-3 text-center col-span-2">
                <p className="text-2xl font-bold text-accent">{daySummary.exitCount}</p>
                <p className="text-xs text-muted-foreground">{t("exit_count") || "طلبات الخروج"}</p>
              </Card>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
