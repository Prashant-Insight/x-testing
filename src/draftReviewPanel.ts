import * as vscode from 'vscode';
import { ApplyResult, Draft, OrchestrationSink, WorkflowState } from './domain';
import { DeploymentService } from './deploymentService';

type DecisionMessage = { type: 'decision'; draftId: string; status: 'approved' | 'rejected'; reason?: string };
type ApplyMessage = { type: 'apply'; draftId: string };
type WebviewMessage = DecisionMessage | ApplyMessage;
type PendingResolver = (decision: DecisionMessage) => void;

export class DraftReviewPanel implements OrchestrationSink {
  private panel: vscode.WebviewPanel | undefined;
  private latestState: WorkflowState | undefined;
  private readonly pendingDecisions = new Map<string, PendingResolver>();
  private stateObserver: ((state: WorkflowState) => void | Promise<void>) | undefined;
  private applyHandler: ((draft: Draft, state: WorkflowState) => Promise<ApplyResult>) | undefined;

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public setStateObserver(observer: ((state: WorkflowState) => void | Promise<void>) | undefined): void { this.stateObserver = observer; }
  public setApplyHandler(handler: (draft: Draft, state: WorkflowState) => Promise<ApplyResult>): void { this.applyHandler = handler; }
  public show(): void { this.ensurePanel().reveal(vscode.ViewColumn.One); }

  public async onStateChanged(state: WorkflowState): Promise<void> {
    this.latestState = state;
    if (this.panel) {
      this.panel.webview.html = this.renderHtml(this.panel.webview);
      await this.panel.webview.postMessage({ type: 'state', state });
    }
    await this.stateObserver?.(state);
  }

  public async requestApproval(draft: Draft, state: WorkflowState): Promise<DecisionMessage> {
    this.latestState = state;
    const panel = this.ensurePanel();
    panel.reveal(vscode.ViewColumn.One);
    panel.webview.html = this.renderHtml(panel.webview);
    await panel.webview.postMessage({ type: 'approval-requested', draftId: draft.draftId, state });
    return new Promise(resolve => this.pendingDecisions.set(draft.draftId, resolve));
  }

  private ensurePanel(): vscode.WebviewPanel {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel('lakepilotDraftReview', 'LakePilot Draft Review', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
      this.panel.webview.onDidReceiveMessage(message => { void this.handleMessage(message as WebviewMessage); }, undefined, this.context.subscriptions);
      this.panel.onDidDispose(() => { this.panel = undefined; }, undefined, this.context.subscriptions);
    }
    return this.panel;
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    if (message.type === 'decision') {
      const resolver = this.pendingDecisions.get(message.draftId);
      if (resolver) {
        this.pendingDecisions.delete(message.draftId);
        resolver(message);
      }
      return;
    }
    if (message.type === 'apply') {
      const state = this.latestState;
      const draft = state?.drafts.find(candidate => candidate.draftId === message.draftId);
      if (!state || !draft || !this.applyHandler || !DeploymentService.isDeployable(draft) || !['approved', 'applied'].includes(draft.status)) return;
      await this.panel?.webview.postMessage({ type: 'apply-started', draftId: draft.draftId });
      const result = await this.applyHandler(draft, state);
      draft.applyResult = result;
      if (result.status !== 'failed') draft.status = 'applied';
      await this.context.globalState.update(`lakepilot.apply.${draft.draftId}`, result);
      await this.onStateChanged(state);
    }
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const state = this.latestState;
    const body = state ? renderState(state) : '<p>No workflow state yet.</p>';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>LakePilot</title></head><body>${body}<script nonce="${nonce}">const vscode=acquireVsCodeApi();document.addEventListener('click',event=>{const target=event.target;if(!(target instanceof HTMLElement))return;const id=target.getAttribute('data-draft');if(target.dataset.action==='approve')vscode.postMessage({type:'decision',draftId:id,status:'approved'});if(target.dataset.action==='reject')vscode.postMessage({type:'decision',draftId:id,status:'rejected',reason:'Rejected in review panel'});if(target.dataset.action==='apply')vscode.postMessage({type:'apply',draftId:id});});</script></body></html>`;
  }
}

function renderState(state: WorkflowState): string {
  const steps = state.steps.map(step => `<li>${escapeHtml(step.title)} — ${escapeHtml(step.status)}</li>`).join('');
  const artifacts = state.artifacts.map(artifact => `<li>${escapeHtml(artifact.type)}: ${escapeHtml(artifact.title)}</li>`).join('');
  const drafts = state.drafts.map(draft => renderDraft(draft)).join('');
  const summary = state.finalSummary ? `<section><h2>Final Summary</h2><p>${escapeHtml(state.finalSummary.markdown)}</p></section>` : '';
  return `<h1>LakePilot</h1><p>Status: ${escapeHtml(state.status)}</p><section><h2>Progress</h2><ol>${steps}</ol></section><section><h2>Drafts</h2>${drafts}</section><section><h2>Artifacts</h2><ul>${artifacts}</ul></section>${summary}`;
}

function renderDraft(draft: Draft): string {
  const approve = draft.approvalRequired && draft.status === 'pending' ? `<button data-action="approve" data-draft="${escapeHtml(draft.draftId)}">Approve</button><button data-action="reject" data-draft="${escapeHtml(draft.draftId)}">Reject</button>` : '';
  const apply = DeploymentService.isDeployable(draft) && ['approved', 'applied'].includes(draft.status) ? `<button data-action="apply" data-draft="${escapeHtml(draft.draftId)}">Apply & Deploy</button>` : '';
  const result = draft.applyResult ? `<h4>Apply Result</h4><pre>${escapeHtml(JSON.stringify(draft.applyResult, null, 2))}</pre>` : '';
  const semantic = draft.draftType === 'semantic-model-review' ? renderSemantic(draft) : '';
  return `<article><h3>${escapeHtml(draft.title)}</h3><p>${escapeHtml(draft.draftType)} — ${escapeHtml(draft.status)}</p>${approve}${apply}<details open><summary>Payload</summary><pre>${escapeHtml(JSON.stringify(draft.payload, null, 2))}</pre></details>${semantic}${result}</article>`;
}

function renderSemantic(draft: Draft): string {
  const payload = draft.payload as { dataConnection?: { connectivityMode: string; serverHostname: string; httpPath: string; table: string; sqlEndpointQuery: string; powerQueryM: string }; semanticModel?: { measures: string[]; tmdl: string } };
  if (!payload.dataConnection || !payload.semanticModel) return '';
  return `<section><h4>Databricks SQL Endpoint</h4><p>${escapeHtml(payload.dataConnection.connectivityMode)} ${escapeHtml(payload.dataConnection.serverHostname)} ${escapeHtml(payload.dataConnection.httpPath)} ${escapeHtml(payload.dataConnection.table)}</p><pre>${escapeHtml(payload.dataConnection.sqlEndpointQuery)}\n\n${escapeHtml(payload.dataConnection.powerQueryM)}</pre><h4>Measures</h4><pre>${escapeHtml(payload.semanticModel.measures.join('\n'))}</pre><h4>TMDL</h4><pre>${escapeHtml(payload.semanticModel.tmdl)}</pre></section>`;
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char); }
function getNonce(): string { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let nonce = ''; for (let i = 0; i < 32; i++) nonce += chars.charAt(Math.floor(Math.random() * chars.length)); return nonce; }
