"use client";

import { useT } from "next-i18next/client";
import type { Translate } from "@trestle/forms";

/** Translates the validation message keys produced by the shared schemas. */
export function useValidationTranslate(): Translate {
  const { t } = useT("validation");
  return (key) => t(key);
}
