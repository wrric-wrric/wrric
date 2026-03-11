import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// add colors
export const colors = {
  primaryGreen: "#00FB75",
  secondary: "#00FF00",
  tertiary: "#0000FF",
}
