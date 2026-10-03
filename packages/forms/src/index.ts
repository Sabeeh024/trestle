export { useZodForm } from "./use-zod-form";
export { applyApiError, fieldError, messageFor, rootError, type Translate } from "./errors";
export { submitForm } from "./submit";

// Re-exported so an app depends on @trestle/forms alone, not on react-hook-form directly.
export { Controller, useWatch } from "react-hook-form";
export type { FieldValues, UseFormReturn } from "react-hook-form";
