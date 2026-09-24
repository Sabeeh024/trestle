import * as React from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"

function NavItem({
  className,
  active = false,
  icon,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"a"> & {
  active?: boolean
  icon?: React.ReactNode
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="nav-item"
      data-active={active}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 data-[active=true]:-ml-[3px] data-[active=true]:border-l-3 data-[active=true]:border-l-primary data-[active=true]:bg-muted data-[active=true]:font-semibold data-[active=true]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {icon}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  )
}

export { NavItem }
