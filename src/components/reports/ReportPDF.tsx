import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// Note: For RTL Arabic support, you'd need to register an Arabic font
// For now, we'll use the built-in Helvetica

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
  },
  header: {
    backgroundColor: "#1e3a5f",
    color: "#c9a84c",
    padding: 15,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: "#ffffff",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e3a5f",
    borderBottom: "1px solid #c9a84c",
    paddingBottom: 5,
    marginBottom: 10,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e2e8f0",
    padding: 5,
  },
  tableHeader: {
    backgroundColor: "#f8f9fc",
    fontWeight: "bold",
    fontSize: 10,
  },
  tableCell: {
    fontSize: 10,
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
  },
  badge: {
    padding: "2 6",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "bold",
  },
  gold: {
    backgroundColor: "#c9a84c",
    color: "#1e3a5f",
  },
  silver: {
    backgroundColor: "#c0c0c0",
    color: "#1e3a5f",
  },
  bronze: {
    backgroundColor: "#cd7f32",
    color: "#ffffff",
  },
  watermark: {
    position: "absolute",
    top: "40%",
    left: "20%",
    fontSize: 48,
    color: "#1e3a5f",
    opacity: 0.1,
    transform: "rotate(-45deg)",
  },
});

export function EmployeeReportPDF({
  employee,
  attendance,
  tasks,
  month,
  year,
  managerName,
  institutionName,
}: {
  employee: any;
  attendance: any[];
  tasks: any[];
  month: string;
  year: string;
  managerName: string;
  institutionName: string;
}) {
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const totalHours = attendance.reduce((sum, a) => sum + (a.hours || 0), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>{institutionName}</Text>
        
        <View style={styles.header}>
          <Text style={styles.title}>{institutionName}</Text>
          <Text style={styles.subtitle}>
            تقرير الموظف: {employee.full_name} — {month} {year}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملخص الحضور</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>التاريخ</Text>
              <Text style={styles.tableCell}>وقت الدخول</Text>
              <Text style={styles.tableCell}>وقت الخروج</Text>
              <Text style={styles.tableCell}>الساعات</Text>
              <Text style={styles.tableCell}>الحالة</Text>
            </View>
            {attendance.map((a, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableCell}>{a.date}</Text>
                <Text style={styles.tableCell}>{a.checkIn}</Text>
                <Text style={styles.tableCell}>{a.checkOut || "—"}</Text>
                <Text style={styles.tableCell}>{a.hours}</Text>
                <Text style={styles.tableCell}>{a.status}</Text>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 10, fontSize: 12, fontWeight: "bold" }}>
            إجمالي الساعات: {totalHours}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملخص المهام</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>المهمة</Text>
              <Text style={styles.tableCell}>النوع</Text>
              <Text style={styles.tableCell}>تاريخ الإسناد</Text>
              <Text style={styles.tableCell}>تاريخ الإكمال</Text>
              <Text style={styles.tableCell}>الحالة</Text>
            </View>
            {tasks.map((t, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableCell}>{t.title}</Text>
                <Text style={styles.tableCell}>{t.type}</Text>
                <Text style={styles.tableCell}>{t.assignedDate}</Text>
                <Text style={styles.tableCell}>{t.completedDate || "—"}</Text>
                <Text style={styles.tableCell}>{t.status}</Text>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 10, fontSize: 12, fontWeight: "bold" }}>
            إجمالي المهام: {tasks.length} | مكتملة: {completedTasks.length}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الإنتاجية</Text>
          <Text style={{ fontSize: 14 }}>
            النتيجة: {(completedTasks.length * 10) + Math.round(totalHours * 2)} / 100
          </Text>
        </View>

        <Text style={styles.footer}>
          تم إنشاء التقرير في: {new Date().toLocaleDateString("ar-IQ")} | المدير: {managerName}
        </Text>
      </Page>
    </Document>
  );
}

export function TeamReportPDF({
  employees,
  month,
  year,
  managerName,
  institutionName,
}: {
  employees: any[];
  month: string;
  year: string;
  managerName: string;
  institutionName: string;
}) {
  const top3 = [...employees]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>{institutionName}</Text>
        
        <View style={styles.header}>
          <Text style={styles.title}>{institutionName}</Text>
          <Text style={styles.subtitle}>
            تقرير فريق العمل — {month} {year}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الملخص العام</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>الإجمالي</Text>
              <Text style={styles.tableCell}>الموظفون</Text>
              <Text style={styles.tableCell}>المهام المكتملة</Text>
              <Text style={styles.tableCell}>إجمالي الساعات</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>{employees.length}</Text>
              <Text style={styles.tableCell}>{employees.length}</Text>
              <Text style={styles.tableCell}>
                {employees.reduce((s, e) => s + e.completedTasks, 0)}
              </Text>
              <Text style={styles.tableCell}>
                {employees.reduce((s, e) => s + e.totalHours, 0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أفضل 3 موظفين</Text>
          {top3.map((emp, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <View style={[styles.badge, i === 0 ? styles.gold : i === 1 ? styles.silver : styles.bronze]}>
                <Text>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "bold" }}>{emp.full_name}</Text>
              <Text style={{ fontSize: 12, color: "#64748b" }}>{emp.score} نقطة</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          تم إنشاء التقرير في: {new Date().toLocaleDateString("ar-IQ")} | المدير: {managerName}
        </Text>
      </Page>

      {employees.map((emp, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <Text style={styles.watermark}>{institutionName}</Text>
          <View style={styles.header}>
            <Text style={styles.title}>{emp.full_name}</Text>
            <Text style={styles.subtitle}>
              {emp.department} — {month} {year}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الإحصائيات</Text>
            <Text style={{ fontSize: 14 }}>
              المهام المكتملة: {emp.completedTasks} | الساعات: {emp.totalHours} | النتيجة: {emp.score}/100
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
