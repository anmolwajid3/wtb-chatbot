export const REQUIRED_PLACEHOLDERS: Record<string, string[]> = {
  intent_router: [],
  mood_tone: [],
  coach_matcher: ["{candidates}", "{need}"],
  formatter: [
    "{base_tone}",
    "{mood}",
    "{example_phrases}",
    "{coaches}",
    "{matching_was_attempted}",
    "{still_missing}",
    "{conversation}",
  ],
  guardrail_check: ["{rules}", "{draft}"],
  response_reviewer: ["{base_tone}", "{mood}", "{coaches}", "{reply}"],
  summarizer: ["{conversation}"],
};