import * as vscode from 'vscode';
import { DeploymentService } from './deploymentService';
import { DraftReviewPanel } from './draftReviewPanel';
import { OrchestrationEngine } from './orchestrationEngine';
import { OrchestrationMode, WorkflowState } from './domain';
import { WorkspaceConnectionService } from './workspaceConnection';

const demoPrompt = 'Clean GitHub JSON source data in a Databricks notebook and build a Power BI semantic model report.';

export function activate(context: vscode.ExtensionContext): void {
  const draftPanel = new DraftReviewPanel(context);
  const workspaceConnection = new WorkspaceConnectionService();
  const deploymentService = new DeploymentService();
  draftPanel.setApplyHandler((draft, state) => deploymentService.apply(draft, state));

  context.subscriptions.push(
    vscode.commands.registerCommand('lakepilot.runOrchestrationDemo', async () => runOrchestration(demoPrompt, 'work', draftPanel, workspaceConnection)),
    vscode.commands.registerCommand('lakepilot.plan', async () => promptAndRun('plan', draftPanel, workspaceConnection)),
    vscode.commands.registerCommand('lakepilot.work', async () => promptAndRun('work', draftPanel, workspaceConnection)),
    vscode.commands.registerCommand('lakepilot.showDraftReview', () => draftPanel.show())
  );

  const handler: vscode.ChatRequestHandler = async (request, _context, stream, token) => {
    const mode = request.command === 'plan' ? 'plan' : 'work';
    const prompt = request.prompt.trim() || demoPrompt;
    draftPanel.setStateObserver((state: WorkflowState) => {
      stream.markdown(`LakePilot status: **${state.status}** (${state.steps.filter(step => step.status === 'completed').length}/${state.steps.length} steps completed)\n\n`);
    });
    const workspace = await workspaceConnection.discover();
    if (token.isCancellationRequested) return;
    const engine = new OrchestrationEngine(prompt, workspace, mode, undefined);
    const state = await engine.run(draftPanel);
    if (state.finalSummary) stream.markdown(state.finalSummary.markdown);
    draftPanel.setStateObserver(undefined);
  };
  context.subscriptions.push(vscode.chat.createChatParticipant('lakepilot.orchestrator', handler));
}

export function deactivate(): void {}

async function promptAndRun(mode: OrchestrationMode, draftPanel: DraftReviewPanel, workspaceConnection: WorkspaceConnectionService): Promise<void> {
  const request = await vscode.window.showInputBox({ title: mode === 'plan' ? 'LakePilot Plan' : 'LakePilot Work', prompt: 'Describe the data/reporting request.', value: demoPrompt });
  if (!request) return;
  await runOrchestration(request, mode, draftPanel, workspaceConnection);
}

async function runOrchestration(request: string, mode: OrchestrationMode, draftPanel: DraftReviewPanel, workspaceConnection: WorkspaceConnectionService): Promise<void> {
  const workspace = await workspaceConnection.discover();
  const engine = new OrchestrationEngine(request, workspace, mode);
  draftPanel.show();
  const state = await engine.run(draftPanel);
  if (state.finalSummary) await vscode.window.showInformationMessage(state.finalSummary.markdown);
}
