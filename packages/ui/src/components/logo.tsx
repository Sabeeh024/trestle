import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const logoMarkVariants = cva(
  "inline-flex shrink-0 items-center justify-center bg-primary font-bold text-primary-foreground",
  {
    variants: {
      size: {
        sm: "size-6 rounded-md text-xs",
        md: "size-7 rounded-md text-sm",
        lg: "size-10 rounded-lg text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

const wordmarkVariants = cva("font-bold text-foreground", {
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

function Logo({
  className,
  size = "md",
  wordmark = true,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof logoMarkVariants> & { wordmark?: boolean }) {
  return (
    <span
      data-slot="logo"
      className={cn("inline-flex items-center gap-2", className)}
      {...(wordmark ? {} : { role: "img", "aria-label": "Trestle" })}
      {...props}
    >
      <span aria-hidden className={logoMarkVariants({ size })}>
        T
      </span>
      {wordmark ? (
        <span className={wordmarkVariants({ size })}>Trestle</span>
      ) : null}
    </span>
  )
}

export { Logo, logoMarkVariants }
