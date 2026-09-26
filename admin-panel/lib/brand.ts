export const PRODUCT_NAME = "Opas";
export const OPERATOR_NAME = "GPT Lab";

export const STAFF_COOKIE = "harbor_session";
export const ORG_COOKIE = "harbor_active_org";
export const LOCALE_COOKIE = "harbor_locale";
export const THEME_COOKIE = "harbor_theme";

export const STARTER_TONE =
  "Warm, clear, and professional. Sound like a thoughtful person helping someone find the right fit. Never robotic, never pushy.";

export const STARTER_GUARDRAILS: { rule_text: string; category: string }[] = [
  {
    rule_text: "Never state, estimate, or imply a specific price or price range.",
    category: "pricing",
  },
  {
    rule_text: "Never give medical or legal advice.",
    category: "medical-legal",
  },
  {
    rule_text:
      "Never mention a person, service, or credential that is not in the verified profiles provided for this conversation.",
    category: "fabrication",
  },
];
