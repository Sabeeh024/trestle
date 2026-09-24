import * as React from "react"
import { cn } from "cn"

function PropertyList({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="property-list"
      className={cn(
        "grid grid-cols-[6.25rem_1fr] items-center gap-3 text-sm",
        className
      )}
      {...props}
    />
  )
}

function PropertyItem({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <>
      <dt data-slot="property-label" className="text-muted-foreground">
        {label}
      </dt>
      <dd
        data-slot="property-value"
        className={cn("m-0 min-w-0 text-foreground", className)}
      >
        {children}
      </dd>
    </>
  )
}

export { PropertyList, PropertyItem }
