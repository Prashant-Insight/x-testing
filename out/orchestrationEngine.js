"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationEngine = exports.capabilityApproval = void 0;
const adaptiveAgents_1 = require("./adaptiveAgents");
exports.capabilityApproval = {
    'business-understanding': 'business-report-review',
    metadata: 'metadata-grid',
    'databricks-assets': 'deployment-review',
    'powerbi-assets': 'semantic-model-review',
    'external-connection': 'external-connection-review'
};
class WorkflowRejectedError extends Error {
    draftId;
    constructor(draftId, reason) {
        super(reason);
        this.draftId = draftId;
    }
}
class OrchestrationEngine {
    planner;
    overrides;
    cleanTable = { catalog: 'main', schema: 'lakepilot_demo', table: 'clean_report_source' };
    businessReport;
    tick = 0;
    state;
    constructor(request, workspace, mode, overrides = {}) {
        this.planner = overrides.planner ?? new adaptiveAgents_1.IntentPlannerAgent();
        this.overrides = overrides.capabilities ?? {};
        const createdAt = this.nextTimestamp();
        this.state = { workflowId: this.makeId(request, mode), request, workspace, mode, status: 'idle', steps: [{ id: 'planner', capability: 'planner', title: 'Adaptive planning', status: 'pending' }], drafts: [], artifacts: [], warnings: [], createdAt, updatedAt: createdAt };
    }
    async run(sink) {
        try {
            this.state.status = 'running';
            this.touch();
            await this.emit(sink);
            this.updateStep('planner', { status: 'running', startedAt: this.state.updatedAt });
            await this.emit(sink);
            const plan = this.planner.createPlan(this.state.request, this.state.workspace, this.state.mode);
            this.state.plan = plan;
            this.state.warnings.push(...plan.warnings);
            this.state.steps.push(...plan.steps.map(step => ({ id: step.id, capability: step.capability, title: step.title, status: 'pending' })));
            this.touch();
            const planDraft = this.planner.createDraft(plan);
            this.addDraft(planDraft);
            this.updateStep('planner', { status: 'waiting', draftId: planDraft.draftId });
            await this.requireApproval(planDraft, 'planner', sink);
            if (this.state.mode === 'plan') {
                this.skipUnexecutedPlanSteps();
            }
            else {
                for (const capability of plan.intent.capabilities) {
                    await this.executeCapability(capability, plan, sink);
                }
            }
            this.complete('completed');
            this.state.finalSummary = this.buildFinalSummary();
            this.touch();
            await this.emit(sink);
        }
        catch (error) {
            if (error instanceof WorkflowRejectedError) {
                this.state.status = 'rejected';
                this.state.warnings.push(`Rejected ${error.draftId}: ${error.message}`);
            }
            else {
                this.state.status = 'failed';
                this.state.warnings.push(error instanceof Error ? error.message : 'Unknown workflow failure');
            }
            this.touch();
            await this.emit(sink);
        }
        return this.state;
    }
    async executeCapability(capability, plan, sink) {
        const step = this.state.steps.find(candidate => candidate.capability === capability && candidate.status === 'pending');
        if (!step)
            return;
        this.updateStep(step.id, { status: 'running', startedAt: this.state.updatedAt });
        await this.emit(sink);
        const result = this.executeAgent(capability, plan);
        if (result.artifacts.length > 0)
            this.addArtifacts(result.artifacts);
        if (!result.draft) {
            this.updateStep(step.id, { status: 'completed', completedAt: this.state.updatedAt });
            await this.emit(sink);
            return;
        }
        const expectedDraftType = exports.capabilityApproval[capability];
        if (result.draft.draftType !== expectedDraftType) {
            throw new Error(`approval-rule-violation: ${capability} produced ${result.draft.draftType}, expected ${expectedDraftType}`);
        }
        this.addDraft(result.draft);
        this.updateStep(step.id, { status: 'waiting', draftId: result.draft.draftId });
        if (capability === 'business-understanding') {
            this.businessReport = result.draft.payload;
        }
        await this.requireApproval(result.draft, step.id, sink);
    }
    executeAgent(capability, plan) {
        const override = this.overrides[capability];
        if (override)
            return override(plan);
        switch (capability) {
            case 'business-understanding': return new adaptiveAgents_1.BusinessUnderstandingAgent().execute(plan);
            case 'synthetic-data': return new adaptiveAgents_1.AdaptiveSyntheticDataAgent().execute();
            case 'metadata': return new adaptiveAgents_1.AdaptiveMetadataAgent().execute();
            case 'databricks-assets': return /job|pipeline|workflow|schedule|task/i.test(plan.intent.request) ? new adaptiveAgents_1.JobPipelineAgent().execute(plan) : new adaptiveAgents_1.AdaptiveDatabricksAgent().execute(plan);
            case 'powerbi-assets': return new adaptiveAgents_1.AdaptivePowerBIAgent().execute(plan, { businessReport: this.businessReport, cleanTable: this.cleanTable, workspaceHost: this.state.workspace.host });
            case 'external-connection': return new adaptiveAgents_1.ExternalConnectionAgent().execute(plan);
        }
    }
    async requireApproval(draft, stepId, sink) {
        this.state.status = 'waiting-for-approval';
        this.touch();
        await this.emit(sink);
        const decision = await sink.requestApproval(draft, this.state);
        if (decision.draftId !== draft.draftId)
            throw new Error(`Approval decision mismatch: expected ${draft.draftId}, received ${decision.draftId}`);
        const storedDraft = this.state.drafts.find(candidate => candidate.draftId === draft.draftId);
        if (!storedDraft)
            throw new Error(`Draft not found: ${draft.draftId}`);
        if (decision.status === 'rejected') {
            storedDraft.status = 'rejected';
            this.updateStep(stepId, { status: 'rejected', completedAt: this.state.updatedAt });
            throw new WorkflowRejectedError(draft.draftId, decision.reason ?? 'User rejected draft');
        }
        storedDraft.status = 'approved';
        this.updateStep(stepId, { status: 'completed', completedAt: this.state.updatedAt });
        this.state.status = 'running';
        this.touch();
        await this.emit(sink);
    }
    updateStep(stepId, patch) {
        const step = this.state.steps.find(candidate => candidate.id === stepId);
        if (step)
            Object.assign(step, patch);
        this.touch();
    }
    addDraft(draft) { this.state.drafts.push(draft); this.touch(); }
    addArtifacts(artifacts) { this.state.artifacts.push(...artifacts); this.touch(); }
    complete(status) { this.state.status = status; this.touch(); }
    touch() { this.state.updatedAt = this.nextTimestamp(); }
    async emit(sink) { await sink.onStateChanged(this.state); }
    skipUnexecutedPlanSteps() {
        for (const step of this.state.steps) {
            if (step.status === 'pending')
                step.status = 'skipped';
        }
        this.touch();
    }
    buildFinalSummary() {
        const pendingApproval = this.state.drafts.filter(draft => draft.approvalRequired && draft.status === 'pending').map(draft => draft.draftId);
        const markdown = `LakePilot completed ${this.state.mode} mode. No external resources were mutated automatically. Deployment happens only after an explicit Apply & Deploy action on an approved draft.`;
        return { markdown, json: { status: this.state.status, drafts: this.state.drafts.length, artifacts: this.state.artifacts.length, pendingApproval, warnings: [...this.state.warnings] } };
    }
    makeId(request, mode) {
        let hash = 0;
        for (const ch of `${mode}:${request}`)
            hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
        return `workflow-${Math.abs(hash)}`;
    }
    nextTimestamp() { return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, this.tick++)).toISOString(); }
}
exports.OrchestrationEngine = OrchestrationEngine;
//# sourceMappingURL=orchestrationEngine.js.map