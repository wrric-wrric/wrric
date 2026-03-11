"use client";

import { AppSidebar } from "../../components/app-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full">
      <AppSidebar />
      <div className="flex-1 h-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
