import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden border border-transparent text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a]:hover:bg-action-primaryHover",
        secondary: "bg-muted text-muted-foreground [a]:hover:bg-muted/80",
        accent: "bg-muted text-primary",
        success: "bg-feedback-successBg text-feedback-success",
        warning: "bg-feedback-warningBg text-feedback-warning",
        destructive: "bg-feedback-dangerBg text-feedback-danger",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
      },
      shape: {
        pill: "rounded-full px-2.5",
        tag: "rounded-sm px-2",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "pill",
    },
  }
)

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

const dotClassName: Record<BadgeVariant, string> = {
  default: "bg-current",
  secondary: "bg-text-disabled",
  accent: "bg-current",
  success: "bg-current",
  warning: "bg-current",
  destructive: "bg-current",
  outline: "bg-text-disabled",
}

function Badge({
  className,
  variant = "default",
  shape = "pill",
  dot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; dot?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-shape={shape}
      className={cn(
        badgeVariants({ variant, shape }),
        dot && shape === "pill" && "pr-2 pl-1.5",
        className
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {dot ? (
            <span
              aria-hidden
              data-slot="badge-dot"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                dotClassName[variant ?? "default"]
              )}
            />
          ) : null}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Badge, badgeVariants }
