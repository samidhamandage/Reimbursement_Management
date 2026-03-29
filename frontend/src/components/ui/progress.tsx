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
      "relative h-1 w-full overflow-hidden rounded-full bg-white/5 shadow-inner",
      className
    )}
    {...props}
  >
    <div
      className="h-full w-full flex-1 bg-primary/80 transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
