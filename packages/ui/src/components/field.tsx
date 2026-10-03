import * as React from "react"
import { cn } from "cn"

import { Label } from "#components/ui/label"

interface FieldControlProps {
  id: string
  "aria-invalid": boolean | undefined
  "aria-describedby": string | undefined
}

type FieldProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode
  description?: React.ReactNode
  /** The message to show when the field is invalid. Presence marks the control aria-invalid. */
  error?: React.ReactNode
  required?: boolean
  /** Shown to the right of the label, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode
  /** Pass a function to receive the id and aria props to spread on the control. */
  children: React.ReactNode | ((control: FieldControlProps) => React.ReactNode)
}

function Field({
  className,
  label,
  description,
  error,
  required = false,
  labelAction,
  children,
  ...props
}: FieldProps) {
  const id = React.useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined

  const control: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  }

  return (
    <div
      data-slot="field"
      data-invalid={error ? true : undefined}
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden className="ms-0.5 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        {labelAction}
      </div>
      {typeof children === "function" ? children(control) : children}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** A form-level message, e.g. a failed submit that is not tied to one field. */
function FormError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="form-error"
      role="alert"
      className={cn(
        "rounded-md bg-feedback-dangerBg px-3 py-2 text-sm text-feedback-danger",
        className
      )}
      {...props}
    />
  )
}

export { Field, FormError, type FieldControlProps }
