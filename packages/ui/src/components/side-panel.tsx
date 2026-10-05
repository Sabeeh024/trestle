import * as React from "react"
import { cn } from "cn"
import { XIcon } from "lucide-react"

import { Button } from "#components/ui/button"

type SidePanelProps = React.ComponentProps<"aside"> & {
  /** Names the panel for assistive technology; a panel without a name is just "complementary". Required. */
  "aria-label": string
  /** Called when the person presses Escape while focus is inside the panel. */
  onClose?: () => void
}

/**
 * A panel beside the page content. It takes focus when it opens, so a keyboard or screen-reader user lands in it
 * rather than being left on the page behind it, and gives focus back to whatever opened it when it closes (if that
 * is still on the page). Escape closes it.
 */
function SidePanel({ className, onClose, onKeyDown, ...props }: SidePanelProps) {
  const ref = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus({ preventScroll: true })
    return () => {
      // Only a real control is worth returning to: after a mouse click the opener is the page body, and after
      // a deletion the opener is gone.
      if (opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return (
    <aside
      ref={ref}
      // Focusable by script only: it receives focus on open but is not an extra stop in the tab order.
      tabIndex={-1}
      data-slot="side-panel"
      className={cn(
        "flex w-95 shrink-0 flex-col overflow-y-auto border-l border-border bg-background outline-none",
        className
      )}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!event.defaultPrevented && event.key === "Escape" && onClose) {
          event.stopPropagation()
          onClose()
        }
      }}
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
      <div className="text-xs font-semibold text-text-tertiary">{children}</div>
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
