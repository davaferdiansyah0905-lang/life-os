"use client";

import * as React from "react";
import { ToastProvider } from "./Toast";
import { DataProvider } from "./DataProvider";
import { UIProvider } from "./UIProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DataProvider>
        <UIProvider>{children}</UIProvider>
      </DataProvider>
    </ToastProvider>
  );
}
