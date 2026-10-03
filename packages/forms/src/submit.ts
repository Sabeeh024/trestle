import type { FieldValues, UseFormReturn } from "react-hook-form";

import { applyApiError } from "./errors";

/**
 * A submit handler that validates first, then runs `action`, and puts any API failure back on the
 * form instead of leaving it as an unhandled rejection.
 *
 *   <form onSubmit={submitForm(form, (values) => createProject.mutateAsync(values))}>
 */
export function submitForm<TInput extends FieldValues, TOutput extends FieldValues | undefined = TInput>(
  form: UseFormReturn<TInput, unknown, TOutput>,
  action: (values: TOutput) => Promise<unknown>,
  fallbackMessage?: string,
) {
  return form.handleSubmit(async (values) => {
    form.clearErrors("root.server");
    try {
      await action(values);
    } catch (error) {
      applyApiError(form, error, fallbackMessage);
    }
  });
}
