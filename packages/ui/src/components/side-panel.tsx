import * as React from "react"
import { cn } from "cn"
import { XIcon } from "lucide-react"

import { Button } from "#components/ui/button"

function SidePanel({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="side-panel"
      className={cn(
        "flex w-95 shrink-0 flex-col overflow-y-auto border-l border-border bg-background",
        className
      )}
      {...props}
    />
  )
}

function SidePanelHeader({
  className,
  children,
  onClose,
  ...props
}: React.ComponentProps<"div"> & { onClose?: () => void }) {
  return (
    <div
      data-slot="side-panel-header"
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border px-5 py-4",
        className
      )}
      {...props}
    >
      <div className="text-xs font-semibold text-text-disabled">{children}</div>
      {onClose ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close panel"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}

function SidePanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-body"
      className={cn("flex flex-col gap-5 p-5", className)}
      {...props}
    />
  )
}

function SidePanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-footer"
      className={cn(
        "mt-auto flex gap-2 border-t border-border px-5 py-4",
        className
      )}
      {...props}
    />
  )
}

export { SidePanel, SidePanelHeader, SidePanelBody, SidePanelFooter }
