"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftReviewPanel = void 0;
const vscode = __importStar(require("vscode"));
const deploymentService_1 = require("./deploymentService");
class DraftReviewPanel {
    context;
    panel;
    latestState;
    pendingDecisions = new Map();
    stateObserver;
    applyHandler;
    constructor(context) {
        this.context = context;
    }
    setStateObserver(observer) { this.stateObserver = observer; }
    setApplyHandler(handler) { this.applyHandler = handler; }
    show() { this.ensurePanel().reveal(vscode.ViewColumn.One); }
    async onStateChanged(state) {
        this.latestState = state;
        if (this.panel) {
            this.panel.webview.html = this.renderHtml(this.panel.webview);
            await this.panel.webview.postMessage({ type: 'state', state });
        }
        await this.stateObserver?.(state);
    }
    async requestApproval(draft, state) {
        this.latestState = state;
        const panel = this.ensurePanel();
        panel.reveal(vscode.ViewColumn.One);
        panel.webview.html = this.renderHtml(panel.webview);
        await panel.webview.postMessage({ type: 'approval-requested', draftId: draft.draftId, state });
        return new Promise(resolve => this.pendingDecisions.set(draft.draftId, resolve));
    }
    ensurePanel() {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel('lakepilotDraftReview', 'LakePilot Draft Review', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
            this.panel.webview.onDidReceiveMessage(message => { void this.handleMessage(message); }, undefined, this.context.subscriptions);
            this.panel.onDidDispose(() => { this.panel = undefined; }, undefined, this.context.subscriptions);
        }
        return this.panel;
    }
    async handleMessage(message) {
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
            if (!state || !draft || !this.applyHandler || !deploymentService_1.DeploymentService.isDeployable(draft) || !['approved', 'applied'].includes(draft.status))
                return;
            await this.panel?.webview.postMessage({ type: 'apply-started', draftId: draft.draftId });
            const result = await this.applyHandler(draft, state);
            draft.applyResult = result;
            if (result.status !== 'failed')
                draft.status = 'applied';
            await this.context.globalState.update(`lakepilot.apply.${draft.draftId}`, result);
            await this.onStateChanged(state);
        }
    }
    renderHtml(webview) {
        const nonce = getNonce();
        const state = this.latestState;
        const body = state ? renderState(state) : '<p>No workflow state yet.</p>';
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>LakePilot</title></head><body>${body}<script nonce="${nonce}">const vscode=acquireVsCodeApi();document.addEventListener('click',event=>{const target=event.target;if(!(target instanceof HTMLElement))return;const id=target.getAttribute('data-draft');if(target.dataset.action==='approve')vscode.postMessage({type:'decision',draftId:id,status:'approved'});if(target.dataset.action==='reject')vscode.postMessage({type:'decision',draftId:id,status:'rejected',reason:'Rejected in review panel'});if(target.dataset.action==='apply')vscode.postMessage({type:'apply',draftId:id});});</script></body></html>`;
    }
}
exports.DraftReviewPanel = DraftReviewPanel;
function renderState(state) {
    const steps = state.steps.map(step => `<li>${escapeHtml(step.title)} — ${escapeHtml(step.status)}</li>`).join('');
    const artifacts = state.artifacts.map(artifact => `<li>${escapeHtml(artifact.type)}: ${escapeHtml(artifact.title)}</li>`).join('');
    const drafts = state.drafts.map(draft => renderDraft(draft)).join('');
    const summary = state.finalSummary ? `<section><h2>Final Summary</h2><p>${escapeHtml(state.finalSummary.markdown)}</p></section>` : '';
    return `<h1>LakePilot</h1><p>Status: ${escapeHtml(state.status)}</p><section><h2>Progress</h2><ol>${steps}</ol></section><section><h2>Drafts</h2>${drafts}</section><section><h2>Artifacts</h2><ul>${artifacts}</ul></section>${summary}`;
}
function renderDraft(draft) {
    const approve = draft.approvalRequired && draft.status === 'pending' ? `<button data-action="approve" data-draft="${escapeHtml(draft.draftId)}">Approve</button><button data-action="reject" data-draft="${escapeHtml(draft.draftId)}">Reject</button>` : '';
    const apply = deploymentService_1.DeploymentService.isDeployable(draft) && ['approved', 'applied'].includes(draft.status) ? `<button data-action="apply" data-draft="${escapeHtml(draft.draftId)}">Apply & Deploy</button>` : '';
    const result = draft.applyResult ? `<h4>Apply Result</h4><pre>${escapeHtml(JSON.stringify(draft.applyResult, null, 2))}</pre>` : '';
    const semantic = draft.draftType === 'semantic-model-review' ? renderSemantic(draft) : '';
    return `<article><h3>${escapeHtml(draft.title)}</h3><p>${escapeHtml(draft.draftType)} — ${escapeHtml(draft.status)}</p>${approve}${apply}<details open><summary>Payload</summary><pre>${escapeHtml(JSON.stringify(draft.payload, null, 2))}</pre></details>${semantic}${result}</article>`;
}
function renderSemantic(draft) {
    const payload = draft.payload;
    if (!payload.dataConnection || !payload.semanticModel)
        return '';
    return `<section><h4>Databricks SQL Endpoint</h4><p>${escapeHtml(payload.dataConnection.connectivityMode)} ${escapeHtml(payload.dataConnection.serverHostname)} ${escapeHtml(payload.dataConnection.httpPath)} ${escapeHtml(payload.dataConnection.table)}</p><pre>${escapeHtml(payload.dataConnection.sqlEndpointQuery)}\n\n${escapeHtml(payload.dataConnection.powerQueryM)}</pre><h4>Measures</h4><pre>${escapeHtml(payload.semanticModel.measures.join('\n'))}</pre><h4>TMDL</h4><pre>${escapeHtml(payload.semanticModel.tmdl)}</pre></section>`;
}
function escapeHtml(value) { return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char); }
function getNonce() { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let nonce = ''; for (let i = 0; i < 32; i++)
    nonce += chars.charAt(Math.floor(Math.random() * chars.length)); return nonce; }
//# sourceMappingURL=draftReviewPanel.js.map