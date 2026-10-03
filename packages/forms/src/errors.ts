import { isApiError } from "@trestle/api-client";
import { isValidationKey, type ValidationKey } from "@trestle/api-client/schemas";
import { get, type FieldValues, type Path, type UseFormReturn, type UseFormSetError } from "react-hook-form";

/** Turns a validation message key into text in the app's language. */
export type Translate = (key: ValidationKey) => string;

/**
 * Schema and server messages are keys like "required"; anything else (a server's plain-English
 * message, say) is shown as it is.
 */
export function messageFor(message: unknown, translate: Translate): string | undefined {
  if (typeof message !== "string" || message === "") return undefined;
  return isValidationKey(message) ? translate(message) : message;
}

/** The error to show under a field, from either the schema or the server. Call it during render. */
export function fieldError<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, "formState">,
  name: Path<T>,
  translate: Translate,
): string | undefined {
  return messageFor(get(form.formState.errors, name)?.message, translate);
}

/** The form-level error to show above the submit button, for failures that belong to no field. */
export function rootError<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, "formState">,
  translate: Translate,
): string | undefined {
  return messageFor(form.formState.errors.root?.server?.message, translate);
}

interface ErrorTarget<T extends FieldValues> {
  setError: UseFormSetError<T>;
  getValues: () => T;
}

/**
 * Puts a failed request onto the form. A validation failure (422) lands on the matching fields;
 * anything else, and fields the form does not have, land on a form-level error.
 */
export function applyApiError<T extends FieldValues>(
  form: ErrorTarget<T>,
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again.",
) {
  if (!isApiError(error)) {
    form.setError("root.server", { type: "server", message: fallbackMessage });
    return;
  }

  const known = new Set(Object.keys(form.getValues()));
  let placed = false;
  for (const [field, message] of Object.entries(error.fields ?? {})) {
    if (!known.has(field)) continue;
    form.setError(field as Path<T>, { type: "server", message });
    placed = true;
  }

  if (!placed) form.setError("root.server", { type: "server", message: error.message });
}
