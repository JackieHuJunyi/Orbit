import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workbench, client, conversationModel, conversationHook, conversationView, dockShell] = await Promise.all([
  readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/agent-client.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/agent-conversation.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/components/use-agent-conversation.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/components/agent-conversation.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/agent-dock-shell.tsx", import.meta.url), "utf8"),
]);

test("keeps Agent transport, thread persistence, and dock presentation outside the Workbench", () => {
  assert.match(workbench, /requestRemoteAgentTurn/);
  assert.match(workbench, /useAgentConversation/);
  assert.match(workbench, /<AgentDockShell/);
  assert.doesNotMatch(workbench, /fetch\("\/api\/agent"/);
  assert.doesNotMatch(workbench, /^type RemoteAgentResponse|^function isRemoteWorkspacePlan/mu);
  assert.match(client, /QUERY_EVIDENCE_REQUIRED/);
  assert.match(client, /normalizeRemoteAgentPlan/);
  assert.match(conversationModel, /MAX_AGENT_CONVERSATION_MESSAGES = 16/);
  assert.match(conversationModel, /MAX_AGENT_CONVERSATION_CONTEXT_MESSAGES = 12/);
  assert.match(conversationHook, /AGENT_CONVERSATION_STORAGE_KEY/);
  assert.match(conversationView, /role="log"/);
  assert.match(dockShell, /Presentation boundary for the movable Agent surface/);
  assert.ok(workbench.split("\n").length <= 6_500, "Workbench must keep shrinking as capability owners are extracted");
});
