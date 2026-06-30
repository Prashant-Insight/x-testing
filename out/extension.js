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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const deploymentService_1 = require("./deploymentService");
const draftReviewPanel_1 = require("./draftReviewPanel");
const orchestrationEngine_1 = require("./orchestrationEngine");
const workspaceConnection_1 = require("./workspaceConnection");
const demoPrompt = 'Clean GitHub JSON source data in a Databricks notebook and build a Power BI semantic model report.';
function activate(context) {
    const draftPanel = new draftReviewPanel_1.DraftReviewPanel(context);
    const workspaceConnection = new workspaceConnection_1.WorkspaceConnectionService();
    const deploymentService = new deploymentService_1.DeploymentService();
    draftPanel.setApplyHandler((draft, state) => deploymentService.apply(draft, state));
    context.subscriptions.push(vscode.commands.registerCommand('lakepilot.runOrchestrationDemo', async () => runOrchestration(demoPrompt, 'work', draftPanel, workspaceConnection)), vscode.commands.registerCommand('lakepilot.plan', async () => promptAndRun('plan', draftPanel, workspaceConnection)), vscode.commands.registerCommand('lakepilot.work', async () => promptAndRun('work', draftPanel, workspaceConnection)), vscode.commands.registerCommand('lakepilot.showDraftReview', () => draftPanel.show()));
    const handler = async (request, _context, stream, token) => {
        const mode = request.command === 'plan' ? 'plan' : 'work';
        const prompt = request.prompt.trim() || demoPrompt;
        draftPanel.setStateObserver((state) => {
            stream.markdown(`LakePilot status: **${state.status}** (${state.steps.filter(step => step.status === 'completed').length}/${state.steps.length} steps completed)\n\n`);
        });
        const workspace = await workspaceConnection.discover();
        if (token.isCancellationRequested)
            return;
        const engine = new orchestrationEngine_1.OrchestrationEngine(prompt, workspace, mode, undefined);
        const state = await engine.run(draftPanel);
        if (state.finalSummary)
            stream.markdown(state.finalSummary.markdown);
        draftPanel.setStateObserver(undefined);
    };
    context.subscriptions.push(vscode.chat.createChatParticipant('lakepilot.orchestrator', handler));
}
function deactivate() { }
async function promptAndRun(mode, draftPanel, workspaceConnection) {
    const request = await vscode.window.showInputBox({ title: mode === 'plan' ? 'LakePilot Plan' : 'LakePilot Work', prompt: 'Describe the data/reporting request.', value: demoPrompt });
    if (!request)
        return;
    await runOrchestration(request, mode, draftPanel, workspaceConnection);
}
async function runOrchestration(request, mode, draftPanel, workspaceConnection) {
    const workspace = await workspaceConnection.discover();
    const engine = new orchestrationEngine_1.OrchestrationEngine(request, workspace, mode);
    draftPanel.show();
    const state = await engine.run(draftPanel);
    if (state.finalSummary)
        await vscode.window.showInformationMessage(state.finalSummary.markdown);
}
//# sourceMappingURL=extension.js.map