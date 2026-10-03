import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldValues, type Resolver, type UseFormProps } from "react-hook-form";
import type { z } from "zod";

/**
 * react-hook-form wired to a zod schema. Validation runs on blur and then on every change, so a
 * field shows its error once it has been visited and clears as soon as it is fixed.
 */
export function useZodForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, "resolver">,
) {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    mode: "onTouched",
    ...options,
    // zodResolver is typed against FieldValues when the schema type is a generic parameter; the
    // schema's own input and output types are what it actually produces.
    resolver: zodResolver(schema) as unknown as Resolver<z.input<TSchema>, unknown, z.output<TSchema>>,
  });
}
