"use client";

import * as React from "react";

export const AlertDialog: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  return <div role="dialog">{children}</div>;
};

export const AlertDialogTrigger: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  // Just render the trigger
  return <>{children}</>;
};

export const AlertDialogContent: React.FC<
  React.PropsWithChildren & React.HTMLAttributes<HTMLDivElement>
> = ({ children, ...props }) => {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="rounded-lg shadow-lg p-4 bg-white"
      {...props}
    >
      {children}
    </div>
  );
};

export const AlertDialogHeader: React.FC<
  React.PropsWithChildren & React.HTMLAttributes<HTMLDivElement>
> = ({ children, ...props }) => (
  <div className="mb-2" {...props}>
    {children}
  </div>
);

export const AlertDialogTitle: React.FC<
  React.PropsWithChildren & React.HTMLAttributes<HTMLHeadingElement>
> = ({ children, ...props }) => (
  <h2 className="text-lg font-bold" {...props}>
    {children}
  </h2>
);

export const AlertDialogDescription: React.FC<
  React.PropsWithChildren & React.HTMLAttributes<HTMLParagraphElement>
> = ({ children, ...props }) => (
  <p className="text-sm text-gray-600" {...props}>
    {children}
  </p>
);

export const AlertDialogFooter: React.FC<
  React.PropsWithChildren & React.HTMLAttributes<HTMLDivElement>
> = ({ children, ...props }) => (
  <div className="mt-4 flex justify-end gap-2" {...props}>
    {children}
  </div>
);

export const AlertDialogCancel: React.FC<
  React.PropsWithChildren & React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, ...props }) => (
  <button className="px-3 py-1 bg-gray-200 rounded" {...props}>
    {children}
  </button>
);

export const AlertDialogAction: React.FC<
  React.PropsWithChildren & React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, ...props }) => (
  <button className="px-3 py-1 bg-blue-600 text-white rounded" {...props}>
    {children}
  </button>
);
