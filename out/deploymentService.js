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
exports.DeploymentService = void 0;
exports.buildDeploymentBlueprint = buildDeploymentBlueprint;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
class DeploymentService {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    static isDeployable(draft) {
        return ['deployment-review', 'semantic-model-review', 'external-connection-review', 'metadata-grid'].includes(draft.draftType);
    }
    async apply(draft, _state) {
        const completedAt = new Date().toISOString();
        const workspaceRoot = this.options.workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const outputFolderSetting = this.options.outputFolder ?? vscode.workspace.getConfiguration('lakepilot.deployment').get('outputFolder', '.lakepilot/deploy');
        const autoApply = this.options.autoApply ?? vscode.workspace.getConfiguration('lakepilot.deployment').get('autoApply', false);
        if (!workspaceRoot) {
            return { status: 'failed', target: draft.draftType, outputFolder: outputFolderSetting, writtenFiles: [], commands: [], logs: ['No workspace folder is open. Open a workspace before applying LakePilot drafts.'], completedAt };
        }
        const outputFolder = path.join(workspaceRoot, outputFolderSetting);
        const logs = [];
        const writtenFiles = [];
        const blueprint = buildDeploymentBlueprint(draft);
        try {
            for (const file of blueprint.files) {
                const absolutePath = path.join(outputFolder, file.relativePath);
                await (0, promises_1.mkdir)(path.dirname(absolutePath), { recursive: true });
                await (0, promises_1.writeFile)(absolutePath, file.content, 'utf8');
                writtenFiles.push(absolutePath);
            }
            let status = 'simulated';
            if (autoApply && blueprint.deployCommand && await this.hasDatabricksCli()) {
                const { stdout, stderr } = await execFileAsync(blueprint.deployCommand.command, blueprint.deployCommand.args, { cwd: outputFolder });
                logs.push(stdout.trim(), stderr.trim());
                status = 'applied';
            }
            else if (autoApply && blueprint.deployCommand) {
                logs.push('Databricks CLI was not detected; deployment remains simulated.');
            }
            else {
                logs.push('Auto-apply is disabled; files were written for review only.');
            }
            return { status, target: blueprint.target, outputFolder, writtenFiles, commands: blueprint.commands, logs: logs.filter(Boolean), completedAt };
        }
        catch (error) {
            return { status: 'failed', target: blueprint.target, outputFolder, writtenFiles, commands: blueprint.commands, logs: [error instanceof Error ? error.message : 'Unknown deployment failure'], completedAt };
        }
    }
    async hasDatabricksCli() {
        try {
            await execFileAsync('databricks', ['--version']);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.DeploymentService = DeploymentService;
function buildDeploymentBlueprint(draft) {
    switch (draft.draftType) {
        case 'deployment-review': return databricksBlueprint(draft.payload);
        case 'semantic-model-review': return powerBiBlueprint(draft.payload);
        case 'external-connection-review': return connectionBlueprint(draft.payload);
        case 'metadata-grid': return metadataBlueprint(draft.payload);
        default: return { target: draft.draftType, files: [], commands: [] };
    }
}
function databricksBlueprint(payload) {
    const scenario = safe(payload.scenario);
    const root = `databricks/${scenario}`;
    const files = [
        { relativePath: `${root}/src/clean_report_source.py`, content: payload.notebookSource },
        { relativePath: `${root}/databricks.yml`, content: `bundle:\n  name: ${scenario}\nresources:\n  jobs: {}\n` },
        { relativePath: `${root}/README.md`, content: `# ${scenario}\n\nReview-only Databricks Asset Bundle generated by LakePilot.\n` }
    ];
    if (payload.jobJson)
        files.push({ relativePath: `${root}/resources/job.json`, content: payload.jobJson });
    return { target: 'databricks-assets', files, commands: ['databricks bundle deploy'], deployCommand: { command: 'databricks', args: ['bundle', 'deploy'] } };
}
function powerBiBlueprint(payload) {
    const scenario = safe(payload.dataConnection.table || 'lakepilot-report');
    return {
        target: 'powerbi-assets',
        files: [
            { relativePath: `powerbi/${scenario}/${scenario}.SemanticModel/definition/model.tmdl`, content: payload.semanticModel.tmdl },
            { relativePath: `powerbi/${scenario}/${scenario}.SemanticModel/definition/expressions.tmdl`, content: `expression DatabricksSource =\n\t${payload.dataConnection.powerQueryM.replace(/\n/g, '\n\t')}\n` },
            { relativePath: `powerbi/${scenario}/${scenario}.pbip`, content: JSON.stringify({ version: '1.0', artifacts: [{ report: { path: `${scenario}.Report` } }, { semanticModel: { path: `${scenario}.SemanticModel` } }] }, null, 2) },
            { relativePath: `powerbi/${scenario}/${scenario}.Report/report.json`, content: JSON.stringify({ pages: payload.reportPages, visuals: payload.visualPlan }, null, 2) },
            { relativePath: `powerbi/${scenario}/${scenario}.connection.md`, content: [`# Databricks SQL endpoint`, `Mode: ${payload.dataConnection.connectivityMode}`, `Host: ${payload.dataConnection.serverHostname}`, `HTTP Path: ${payload.dataConnection.httpPath}`, `Table: ${payload.dataConnection.catalog}.${payload.dataConnection.schema}.${payload.dataConnection.table}`, `SQL: ${payload.dataConnection.sqlEndpointQuery}`].join('\n') }
        ],
        commands: ['Review PBIP files in Power BI Desktop', 'databricks bundle deploy']
    };
}
function connectionBlueprint(payload) {
    const scenario = safe(payload.connectionName);
    return { target: 'external-connection', files: [{ relativePath: `connections/${scenario}/README.md`, content: payload.ingestionNotes.join('\n') }, { relativePath: `connections/${scenario}/connection.json`, content: payload.configJson }], commands: ['Review external connection before use'] };
}
function metadataBlueprint(payload) {
    const scenario = safe(`${payload.catalog}-${payload.schema}-${payload.table}`);
    return { target: 'metadata', files: [{ relativePath: `metadata/${scenario}/metadata.json`, content: JSON.stringify(payload, null, 2) }, { relativePath: `metadata/${scenario}/README.md`, content: `# Metadata for ${payload.catalog}.${payload.schema}.${payload.table}\n` }], commands: ['Review metadata grid before publishing'] };
}
function safe(value) { return value.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-|-$/g, '') || 'lakepilot'; }
//# sourceMappingURL=deploymentService.js.map