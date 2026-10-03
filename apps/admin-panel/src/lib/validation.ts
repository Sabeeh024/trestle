import type { Translate } from "@trestle/forms";
import { sharedResources } from "@trestle/i18n";

// The admin panel is English-only, so the shared validation messages are read straight from the
// English resources rather than through an i18n instance.
export const translate: Translate = (key) => sharedResources.en.validation[key];

export const roleLabels = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" } as const;
export const planLabels = { free: "Free", pro: "Pro", enterprise: "Enterprise" } as const;
