import { getPool } from "@/lib/db";
import { canEditCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { savePrompt, resetPrompt } from "./actions";
import { REQUIRED_PLACEHOLDERS } from "./requiredPlaceholders";
import { DEFAULT_PROMPTS } from "./defaultPrompts";
import PromptEditor from "./PromptEditor";

export const dynamic = "force-dynamic";

export default async function MasterPromptsPage() {
  const workspace = await getWorkspace();
  if (workspace && !canEditCompany(workspace.session.role)) redirect("/home");
  if (!workspace?.organization) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="font-display text-2xl text-neutral-100 mb-2">Prompts</h1>
        <p className="text-sm text-neutral-400">Open a company to edit the instructions its assistant uses.</p>
      </div>
    );
  }
  const pool = getPool();
  const result = await pool.query(
    `SELECT agent_name, system_prompt FROM company_agent_prompts WHERE organization_id = $1`,
    [workspace.organization.id]
  );
  const overrides: Record<string, string> = {};
  for (const row of result.rows) {
    overrides[row.agent_name] = row.system_prompt;
  }

  const agentOrder = [
    "intent_router",
    "mood_tone",
    "coach_matcher",
    "formatter",
    "guardrail_check",
    "response_reviewer",
    "summarizer",
  ];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        Master Prompts
      </h1>
      <p className="text-sm text-neutral-400 mb-2">
        The actual instructions each agent runs on. Edits take effect on the very next chatbot
        request, no restart or redeploy needed.
      </p>
      <p className="text-xs text-amber-500/80 mb-6">
        Read this before editing: the hard safety rules (no price promises, no medical/legal
        advice, no inventing coaches) are enforced independently by the Guardrail Check agent and
        by the Coach Matcher only ever returning verified database IDs — editing another agent's
        prompt here cannot bypass those. But editing the Guardrail Check&apos;s own prompt below
        directly weakens that specific safety net, since there is nothing else checking its work.
        Edit that one with real care, and test thoroughly after any change to it.
      </p>

      {agentOrder.map((agentName) => {
        const isOverridden = agentName in overrides;
        const currentPrompt = isOverridden ? overrides[agentName] : DEFAULT_PROMPTS[agentName].text;
        return (
          <PromptEditor
            key={agentName}
            agentName={agentName}
            agentLabel={DEFAULT_PROMPTS[agentName].label}
            currentPrompt={currentPrompt}
            isOverridden={isOverridden}
            requiredPlaceholders={REQUIRED_PLACEHOLDERS[agentName] || []}
            savePrompt={savePrompt}
            resetPrompt={resetPrompt}
          />
        );
      })}
    </div>
  );
}