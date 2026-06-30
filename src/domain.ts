export type DraftType = 'plan-review' | 'metadata-grid' | 'deployment-review' | 'semantic-model-review' | 'business-report-review' | 'external-connection-review' | 'final-approval';
export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'applied';
export type WorkflowStatus = 'idle' | 'running' | 'waiting-for-approval' | 'completed' | 'rejected' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'waiting' | 'rejected' | 'skipped';
export type OrchestrationMode = 'plan' | 'work';
export type AgentCapability = 'synthetic-data' | 'metadata' | 'databricks-assets' | 'powerbi-assets' | 'business-understanding' | 'external-connection';

export interface DatabricksWorkspaceConnection { source: string; host: string; workspaceId?: string; profile?: string; }
export interface UserIntent { request: string; mode: OrchestrationMode; capabilities: AgentCapability[]; }
export interface AdaptivePlanStep { id: string; capability: AgentCapability; title: string; rationale: string; approvalRequired: boolean; draftType?: DraftType; }
export interface AdaptivePlan { intent: UserIntent; steps: AdaptivePlanStep[]; skippedCapabilities: AgentCapability[]; warnings: string[]; }
export interface WorkflowStep { id: string; capability: AgentCapability | 'planner'; title: string; status: StepStatus; draftId?: string; startedAt?: string; completedAt?: string; }
export interface Artifact { artifactId: string; type: string; title: string; content: string; createdAt: string; }
export interface FinalSummary { markdown: string; json: { status: WorkflowStatus; drafts: number; artifacts: number; pendingApproval: string[]; warnings: string[]; }; }
export interface WorkflowState { workflowId: string; request: string; workspace: DatabricksWorkspaceConnection; mode: OrchestrationMode; status: WorkflowStatus; steps: WorkflowStep[]; drafts: Draft[]; artifacts: Artifact[]; warnings: string[]; createdAt: string; updatedAt: string; plan?: AdaptivePlan; finalSummary?: FinalSummary; }
export interface DraftDecision { draftId: string; status: 'approved' | 'rejected'; reason?: string; }
export interface ApplyResult { status: 'applied' | 'simulated' | 'failed'; target: string; outputFolder: string; writtenFiles: string[]; commands: string[]; logs: string[]; completedAt: string; }
export interface Draft<TPayload = DraftPayload> { draftId: string; draftType: DraftType; approvalRequired: boolean; title: string; agentName: string; status: DraftStatus; createdAt: string; payload: TPayload; applyResult?: ApplyResult; }
export interface OrchestrationSink { onStateChanged(state: WorkflowState): void | Promise<void>; requestApproval(draft: Draft, state: WorkflowState): Promise<DraftDecision>; }

export interface MetadataDraftPayload { catalog: string; schema: string; table: string; primaryKeys: string[]; watermarks: string[]; incrementalStrategy: string; columns: { name: string; type: string; description: string }[]; }
export interface NotebookDraftPayload { scenario: string; catalog: string; schema: string; sourceTable: string; targetTable: string; notebookPath: string; notebookSource: string; jobJson?: string; }
export interface BusinessReportDraftPayload { reportIntent: string; detectedFields: { name: string; type: string; businessMeaning: string }[]; cleaningOperations: string[]; businessQuestions: string[]; visuals: { name: string; type: string; fields: string[]; intent: string }[]; recommendations: string[]; }
export interface ExternalConnectionDraftPayload { sourceType: string; sourceHint: string; connectionName: string; secretRequirements: string[]; ingestionNotes: string[]; configJson: string; }
export interface PlanReviewPayload { plan: AdaptivePlan; summary: string; }
export interface FinalApprovalPayload { summary: FinalSummary; }
export interface PowerBIColumn { name: string; dataType: 'string' | 'int64' | 'decimal' | 'double' | 'dateTime' | 'boolean'; businessMeaning: string; }
export interface PowerBIDataConnection { connectivityMode: 'DirectQuery' | 'Import'; connector: 'Databricks'; serverHostname: string; httpPath: string; catalog: string; schema: string; table: string; sqlEndpointQuery: string; powerQueryM: string; notes: string[]; }
export interface PowerBIDraftPayload { businessSummary: string; formatPriority: string[]; dataConnection: PowerBIDataConnection; semanticModel: { tables: { name: string; columns: PowerBIColumn[] }[]; relationships: string[]; measures: string[]; tmdl: string }; visualPlan: { name: string; type: string; fields: string[]; intent: string }[]; reportPages: { name: string; businessQuestion: string; visuals: string[] }[]; publishingRules: string[]; }
export type DraftPayload = MetadataDraftPayload | NotebookDraftPayload | BusinessReportDraftPayload | ExternalConnectionDraftPayload | PlanReviewPayload | FinalApprovalPayload | PowerBIDraftPayload;
