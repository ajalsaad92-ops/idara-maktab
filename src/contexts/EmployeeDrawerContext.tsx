import React, { createContext, useContext, useState } from "react";
import { EmployeeDetailDrawer } from "@/components/employee/EmployeeDetailDrawer";

type EmployeeDrawerContextType = {
  openEmployeeDrawer: (employeeId: string) => void;
  closeDrawer: () => void;
  employeeId: string | null;
  isOpen: boolean;
};

const EmployeeDrawerContext = createContext<EmployeeDrawerContextType | undefined>(undefined);

export function EmployeeDrawerProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const openEmployeeDrawer = (id: string) => setOpenId(id);
  const closeDrawer = () => setOpenId(null);

  return (
    <EmployeeDrawerContext.Provider value={{ openEmployeeDrawer, closeDrawer, employeeId: openId, isOpen: !!openId }}>
      {children}
      <EmployeeDetailDrawer />
    </EmployeeDrawerContext.Provider>
  );
}

export function useEmployeeDrawer() {
  const context = useContext(EmployeeDrawerContext);
  if (!context) {
    throw new Error("useEmployeeDrawer must be used within an EmployeeDrawerProvider");
  }
  return context;
}