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
const assert = __importStar(require("assert"));
const promises_1 = require("fs/promises");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const deploymentService_1 = require("../deploymentService");
const orchestrationEngine_1 = require("../orchestrationEngine");
const workspace = { source: 'test', host: 'adb-test.azuredatabricks.net' };
const workPrompt = 'Clean a GitHub JSON source with a Databricks notebook and create a Power BI semantic model report.';
class AutoApprovalSink {
    rejectDraftType;
    approvalTypes = [];
    states = [];
    constructor(rejectDraftType) {
        this.rejectDraftType = rejectDraftType;
    }
    onStateChanged(state) {
        this.states.push(JSON.parse(JSON.stringify(state)));
    }
    requestApproval(draft) {
        this.approvalTypes.push(draft.draftType);
        if (draft.draftType === this.rejectDraftType) {
            return Promise.resolve({ draftId: draft.draftId, status: 'rejected', reason: `Rejected ${draft.draftType}` });
        }
        return Promise.resolve({ draftId: draft.draftId, status: 'approved' });
    }
}
suite('LakePilot orchestration', () => {
    test('Adaptive selection (work mode)', async () => {
        const sink = new AutoApprovalSink();
        const state = await new orchestrationEngine_1.OrchestrationEngine(workPrompt, workspace, 'work').run(sink);
        assert.strictEqual(state.status, 'completed');
        assert.deepStrictEqual(sink.approvalTypes, ['plan-review', 'business-report-review', 'deployment-review', 'semantic-model-review', 'external-connection-review']);
        assert.ok(state.plan?.intent.capabilities.includes('databricks-assets'));
        assert.ok(state.plan?.intent.capabilities.includes('powerbi-assets'));
        assert.ok(state.plan?.intent.capabilities.includes('external-connection'));
        assert.ok(!state.plan?.intent.capabilities.includes('metadata'));
        assert.ok(!state.plan?.intent.capabilities.includes('synthetic-data'));
        assert.ok(state.artifacts.some(artifact => artifact.type === 'notebook-review'));
        assert.ok(state.artifacts.some(artifact => artifact.type === 'semantic-model-review'));
        assert.deepStrictEqual(state.finalSummary?.json.pendingApproval, []);
    });
    test('Plan mode stops after plan approval', async () => {
        const sink = new AutoApprovalSink();
        const state = await new orchestrationEngine_1.OrchestrationEngine('Create a scheduled job pipeline workflow for the clean report source.', workspace, 'plan').run(sink);
        assert.strictEqual(state.status, 'completed');
        assert.deepStrictEqual(sink.approvalTypes, ['plan-review']);
        assert.ok(state.plan?.intent.capabilities.includes('databricks-assets'));
        assert.ok(state.steps.some(step => step.status === 'skipped'));
    });
    test('Rejection short-circuits', async () => {
        const sink = new AutoApprovalSink('plan-review');
        const state = await new orchestrationEngine_1.OrchestrationEngine(workPrompt, workspace, 'work').run(sink);
        assert.strictEqual(state.status, 'rejected');
        assert.deepStrictEqual(sink.approvalTypes, ['plan-review']);
        assert.ok(state.warnings.some(warning => warning.includes('Rejected plan-review')));
        assert.strictEqual(state.drafts.find(draft => draft.draftType === 'plan-review')?.status, 'rejected');
        assert.ok(!state.drafts.some(draft => draft.draftType === 'deployment-review'));
    });
    test('No-mismatch invariant', async () => {
        const wrongDraft = {
            draftId: 'wrong-draft',
            draftType: 'metadata-grid',
            approvalRequired: true,
            title: 'Wrong draft',
            agentName: 'FakeAgent',
            status: 'pending',
            createdAt: '2026-01-01T00:00:00.000Z',
            payload: { catalog: 'main', schema: 'lakepilot_demo', table: 'x', primaryKeys: [], watermarks: [], incrementalStrategy: 'none', columns: [] }
        };
        const sink = new AutoApprovalSink();
        const state = await new orchestrationEngine_1.OrchestrationEngine(workPrompt, workspace, 'work', { capabilities: { 'databricks-assets': () => ({ draft: wrongDraft, artifacts: [] }) } }).run(sink);
        assert.strictEqual(state.status, 'failed');
        assert.ok(state.warnings.some(warning => warning.includes('approval-rule-violation')));
        assert.ok(!state.drafts.some(draft => draft.draftId === 'wrong-draft'));
        const powerBiStep = state.steps.find(step => step.capability === 'powerbi-assets');
        assert.strictEqual(powerBiStep?.status, 'pending');
    });
    test('Single-flight ordering', async () => {
        const sink = new AutoApprovalSink();
        await new orchestrationEngine_1.OrchestrationEngine(workPrompt, workspace, 'work').run(sink);
        const timestamps = sink.states.map(state => state.updatedAt);
        for (let index = 1; index < timestamps.length; index++) {
            assert.ok(timestamps[index] >= timestamps[index - 1]);
        }
        assertPreviousApprovedBeforeRunning(sink.states, 'deployment-review', 'databricks-assets');
        assertPreviousApprovedBeforeRunning(sink.states, 'business-report-review', 'powerbi-assets');
        assertPreviousApprovedBeforeRunning(sink.states, 'semantic-model-review', 'external-connection');
    });
    test('Deployment blueprint and simulated apply for semantic model', async () => {
        const sink = new AutoApprovalSink();
        const state = await new orchestrationEngine_1.OrchestrationEngine(workPrompt, workspace, 'work').run(sink);
        const semanticDraft = state.drafts.find(draft => draft.draftType === 'semantic-model-review');
        assert.ok(semanticDraft);
        const blueprint = (0, deploymentService_1.buildDeploymentBlueprint)(semanticDraft);
        assert.ok(blueprint.files.some(file => file.relativePath.endsWith('model.tmdl')));
        assert.ok(blueprint.files.some(file => file.relativePath.endsWith('expressions.tmdl') && file.content.includes('Databricks.Catalogs')));
        assert.ok(blueprint.files.some(file => file.relativePath.endsWith('.pbip')));
        assert.ok(blueprint.files.some(file => file.relativePath.endsWith('report.json')));
        const workspaceRoot = await (0, promises_1.mkdtemp)(path.join(os.tmpdir(), 'lakepilot-'));
        const result = await new deploymentService_1.DeploymentService({ workspaceRoot, autoApply: false }).apply(semanticDraft, state);
        assert.strictEqual(result.status, 'simulated');
        assert.ok(result.writtenFiles.length > 0);
        assert.ok(result.commands.length > 0);
    });
});
function assertPreviousApprovedBeforeRunning(states, previousDraftType, runningCapability) {
    const runningState = states.find(state => state.steps.some(step => step.capability === runningCapability && step.status === 'running'));
    assert.ok(runningState, `Missing running state for ${runningCapability}`);
    assert.strictEqual(runningState.drafts.find(draft => draft.draftType === previousDraftType)?.status, 'approved');
}
//# sourceMappingURL=extension.test.js.map