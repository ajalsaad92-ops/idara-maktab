import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { 
  Home, 
  Users, 
  CheckSquare, 
  BarChart3, 
  Clock, 
  Building2, 
  FileText, 
  Search, 
  Settings, 
  LogOut,
  HelpCircle,
  ClipboardList,
  Shield,
  Bell,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "@tanstack/react-router";
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";

export function AppSidebar() {
  const { t, lang, dir } = useI18n();
  const { role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isRTL = dir === "rtl";

  const menuItems = useMemo(() => {
    if (!role) return [];
    
    const base = { title: t("dashboard"), icon: Home, path: "/", page: undefined };
    
    if (role === "admin") {
      return [
        base,
        { title: t("employees"), icon: Users, path: "/", page: "employees" },
        { title: t("tasks"), icon: CheckSquare, path: "/", page: "tasks" },
        { title: t("productivity_table"), icon: BarChart3, path: "/", page: "productivity" },
        { title: t("attendance_log"), icon: Clock, path: "/", page: "attendance" },
        { title: t("departments"), icon: Building2, path: "/", page: "departments" },
        { title: t("reports"), icon: FileText, path: "/", page: "reports" },
        { title: t("audit_log"), icon: Shield, path: "/", page: "audit" },
        { title: t("settings"), icon: Settings, path: "/", page: "settings" },
      ];
    }
    
    if (role === "manager") {
      return [
        base,
        { title: t("employees"), icon: Users, path: "/", page: "employees" },
        { title: t("tasks"), icon: CheckSquare, path: "/", page: "tasks" },
        { title: t("productivity_table"), icon: BarChart3, path: "/", page: "productivity" },
        { title: t("attendance_log"), icon: Clock, path: "/", page: "attendance" },
        { title: t("reports"), icon: FileText, path: "/", page: "reports" },
        { title: t("exit_requests"), icon: ClipboardList, path: "/", page: "exit-requests" },
      ];
    }
    
    // employee
    return [
      base,
      { title: t("my_tasks"), icon: CheckSquare, path: "/", page: "tasks" },
      { title: t("attendance_log"), icon: Clock, path: "/", page: "attendance" },
    ];
  }, [role, t]);

  return (
    <Sidebar 
      side={isRTL ? "right" : "left"}
      className="backdrop-blur-md bg-primary/95 text-white border-r border-white/10 shadow-xl"
    >
      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 py-6 border-b border-white/10">
            <h2 className="text-accent text-lg font-bold">{t("app_name") || "المُراقب"}</h2>
            <p className="text-white/50 text-xs mt-1">{t("subtitle") || "نظام إدارة الموظفين"}</p>
            {role && (
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                role === "admin"
                  ? "bg-accent/20 text-accent"
                  : role === "manager"
                    ? "bg-blue-400/20 text-blue-300"
                    : "bg-white/10 text-white/60"
              }`}>
                {role === "admin" ? (t("admin") || "مدير عام") : role === "manager" ? (t("manager") || "مدير مكتب") : (t("employee") || "موظف")}
              </span>
            )}
          </div>
          <SidebarGroupContent className="pt-2">
            <SidebarMenu>
              {menuItems.map((item) => {
                const currentPage = (location.search as any)?.page;
                const isActive = item.page 
                  ? currentPage === item.page
                  : location.pathname === "/" && !currentPage;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className="hover:bg-white/10 hover:text-accent transition-all duration-200 text-white"
                    >
                      <Link 
                        to={item.path}
                        search={item.page ? { page: item.page } : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive 
                            ? isRTL 
                              ? "border-r-4 border-accent bg-accent/15 text-white font-semibold" 
                              : "border-l-4 border-accent bg-accent/15 text-white font-semibold"
                            : "hover:bg-white/10 hover:text-accent hover:translate-x-1 text-white/80"
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/" search={{ page: "help" }} className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                    <HelpCircle className="w-5 h-5" />
                    <span>{t("help") || "المساعدة"}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => signOut()}
                  className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                  <span>{t("logout")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
