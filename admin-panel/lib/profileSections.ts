export const PROFILE_SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: "1. Basic Info",
    keys: ["coach_name", "company_name", "business_id", "email", "phone", "website_or_linkedin", "operating_area"],
  },
  {
    title: "2. Service Basic Info",
    keys: ["program_name", "short_description", "long_description"],
  },
  {
    title: "3. Target Group & Situation",
    keys: ["target_group", "suited_situations"],
  },
  {
    title: "4. Content & Themes",
    keys: ["key_themes", "participant_activities", "methods"],
  },
  {
    title: "5. Delivery Model",
    keys: ["delivery_format", "individual_or_group", "group_size_min", "group_size_max", "duration", "program_structure"],
  },
  {
    title: "6. Goals & Outcomes",
    keys: ["goals", "impact_measurement", "change_achieved"],
  },
  {
    title: "7. Pricing & Sales",
    keys: ["price_from", "pricing_model", "price_includes", "additional_services"],
  },
  {
    title: "8. References & Track Record",
    keys: ["references_text", "results_feedback", "certifications"],
  },
  {
    title: "9. Keywords & Classification",
    keys: ["keywords", "main_category", "subcategories"],
  },
  {
    title: "10. Additional Info",
    keys: ["additional_info", "availability", "languages"],
  },
  {
    title: "11. Media & Materials",
    keys: ["video_url", "material_urls"],
  },
];

export const PROFILE_SECTION_TITLES = PROFILE_SECTIONS.map((section) => section.title);

export function sectionForField(groupName: string | null | undefined) {
  if (groupName && PROFILE_SECTION_TITLES.includes(groupName)) return groupName;
  return PROFILE_SECTION_TITLES[0];
}
