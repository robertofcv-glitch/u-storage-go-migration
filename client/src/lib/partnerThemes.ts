import { PartnerTheme } from "@/components/quote/QuoteWizard";

/**
 * Canonical partner theme definitions.
 *
 * This is the single source of truth for partner branding used across both the
 * standalone quote page (`/quote?partner=...`) and the embeddable partner
 * experiences (`/embed/...`). Do not duplicate these values in components.
 */
export const PARTNER_THEMES: Record<string, PartnerTheme> = {
  // Now that the whole platform carries U-Storage Go branding, the u-storage
  // partner theme simply mirrors the main brand (orange primary, purple accent).
  "u-storage": {
    id: "u-storage",
    name: "U-Storage Go",
    primaryColor: "#EF7521",
    secondaryColor: "#502864",
    logo: "/logo.png",
    headerText: "Mudanzas U-Storage Go",
  },
};

export function getPartnerTheme(partner?: string | null): PartnerTheme | undefined {
  if (!partner) return undefined;
  return PARTNER_THEMES[partner];
}
