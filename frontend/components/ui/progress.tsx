"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/5",
            className
        )}
        {...props}
    >
        <div
            className="h-full w-full flex-1 bg-primary transition-all duration-500 ease-in-out shadow-[0_0_15px_rgba(0,251,117,0.4)]"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </div>
))
Progress.displayName = "Progress"

export { Progress }
