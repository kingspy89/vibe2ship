import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
      {
        "border-transparent bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30": variant === "default",
        "border-transparent bg-slate-800 text-slate-300 hover:bg-slate-700": variant === "secondary",
        "border-transparent bg-red-500/20 text-red-400 hover:bg-red-500/30": variant === "destructive",
        "text-slate-300 border-slate-700": variant === "outline",
      },
      className
    )} {...props} />
  )
}

export { Badge }
