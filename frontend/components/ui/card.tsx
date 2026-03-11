// components/ui/card.tsx
"use client";
import * as React from "react";

console.log("[FIX TEST] components/ui/card.tsx executing");

export const Card = ({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`glass rounded-3xl p-6 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] ${className}`}>{children}</div>
);
export const CardHeader = ({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`mb-6 flex flex-col space-y-1.5 ${className}`}>{children}</div>
);
export const CardContent = ({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`${className}`}>{children}</div>
);
export const CardFooter = ({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`mt-6 flex items-center pt-0 ${className}`}>{children}</div>
);
export const CardTitle = ({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) => (
  <h3 className={`text-2xl font-bold tracking-tight text-foreground ${className}`}>{children}</h3>
);
export const CardDescription = ({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) => (
  <p className={`text-sm text-muted-foreground/80 ${className}`}>{children}</p>
);
