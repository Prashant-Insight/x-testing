"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptivePowerBIAgent = exports.AdaptiveSyntheticDataAgent = exports.ExternalConnectionAgent = exports.AdaptiveMetadataAgent = exports.JobPipelineAgent = exports.AdaptiveDatabricksAgent = exports.BusinessUnderstandingAgent = exports.IntentPlannerAgent = void 0;
const order = ['business-understanding', 'synthetic-data', 'metadata', 'databricks-assets', 'powerbi-assets', 'external-connection'];
function now() { return '2026-01-01T00:00:00.000Z'; }
function slug(input) { return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lakepilot'; }
function id(prefix, input) { let hash = 0; for (const ch of input) {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
} return `${prefix}-${Math.abs(hash)}`; }
function draft(draftType, title, agentName, payload) { return { draftId: id(draftType, `${title}:${JSON.stringify(payload)}`), draftType, approvalRequired: true, title, agentName, status: 'pending', createdAt: now(), payload }; }
function artifact(type, title, content) { return { artifactId: id(type, `${title}:${content}`), type, title, content, createdAt: now() }; }
function has(request, regex) { return regex.test(request.toLowerCase()); }
class IntentPlannerAgent {
    createPlan(request, workspace, mode) {
        const capabilities = new Set(['business-understanding']);
        if (has(request, /notebook|delta|clean|ingest|json|csv|github/))
            capabilities.add('databricks-assets');
        if (has(request, /power\s*bi|powerbi|semantic|report/))
            capabilities.add('powerbi-assets');
        if (has(request, /github|api|url|source/))
            capabilities.add('external-connection');
        if (has(request, /metadata|watermark|incremental|primary key/))
            capabilities.add('metadata');
        if (has(request, /synthetic|sample data/))
            capabilities.add('synthetic-data');
        const selected = order.filter(capability => capabilities.has(capability));
        const skippedCapabilities = order.filter(capability => !capabilities.has(capability));
        const plan = {
            intent: { request, mode, capabilities: selected },
            skippedCapabilities,
            warnings: workspace.host ? [] : ['Workspace host is not configured; generated drafts use placeholders.'],
            steps: selected.map((capability, index) => ({ id: `step-${index + 1}-${capability}`, capability, title: titleFor(capability), rationale: rationaleFor(capability, request), approvalRequired: capability !== 'synthetic-data', draftType: draftTypeFor(capability) }))
        };
        return plan;
    }
    createDraft(plan) {
        return draft('plan-review', 'Review adaptive orchestration plan', 'IntentPlannerAgent', { plan, summary: `LakePilot selected ${plan.intent.capabilities.join(', ')}.` });
    }
}
exports.IntentPlannerAgent = IntentPlannerAgent;
class BusinessUnderstandingAgent {
    execute(plan) {
        const request = plan.intent.request;
        const fields = [
            { name: 'event_date', type: 'dateTime', businessMeaning: 'Date used for trend analysis and freshness checks.' },
            { name: 'customer_id', type: 'string', businessMeaning: 'Customer or entity identifier for grouping.' },
            { name: 'amount', type: 'decimal', businessMeaning: 'Primary numeric value for totals and averages.' },
            { name: 'category', type: 'string', businessMeaning: 'Business segment for contribution analysis.' }
        ];
        const payload = {
            reportIntent: request,
            detectedFields: fields,
            cleaningOperations: ['Normalize column names', 'Drop malformed records', 'Add quality_status', 'Deduplicate business keys'],
            businessQuestions: ['What is the overall record volume?', 'Which categories contribute most?', 'How does activity trend over time?', 'What data quality issues need attention?'],
            visuals: [
                { name: 'Record Count', type: 'card', fields: ['customer_id'], intent: 'Summarize row volume.' },
                { name: 'Amount Trend', type: 'line', fields: ['event_date', 'amount'], intent: 'Show change over time.' },
                { name: 'Top Categories', type: 'bar', fields: ['category', 'amount'], intent: 'Rank contributors.' }
            ],
            recommendations: ['Use DirectQuery for freshness.', 'Review quality_status before publishing.', 'Confirm SQL warehouse httpPath before deployment.']
        };
        return { draft: draft('business-report-review', 'Review business understanding', 'BusinessUnderstandingAgent', payload), artifacts: [] };
    }
}
exports.BusinessUnderstandingAgent = BusinessUnderstandingAgent;
class AdaptiveDatabricksAgent {
    execute(plan) {
        const scenario = slug(plan.intent.request);
        const payload = {
            scenario,
            catalog: 'main',
            schema: 'lakepilot_demo',
            sourceTable: 'raw_input',
            targetTable: 'clean_report_source',
            notebookPath: `databricks/${scenario}/src/clean_report_source.py`,
            notebookSource: [
                '# LakePilot generated notebook draft',
                'from pyspark.sql import functions as F',
                "source = spark.table('main.lakepilot_demo.raw_input')",
                "clean = source.dropDuplicates().withColumn('quality_status', F.lit('review'))",
                "clean.write.mode('overwrite').saveAsTable('main.lakepilot_demo.clean_report_source')"
            ].join('\n')
        };
        return { draft: draft('deployment-review', 'Review Databricks notebook draft', 'AdaptiveDatabricksAgent', payload), artifacts: [artifact('notebook-review', 'Databricks notebook review', payload.notebookSource)] };
    }
}
exports.AdaptiveDatabricksAgent = AdaptiveDatabricksAgent;
class JobPipelineAgent {
    execute(plan) {
        const base = new AdaptiveDatabricksAgent().execute(plan).draft?.payload;
        const jobJson = JSON.stringify({ name: `${base.scenario}-job`, tasks: [{ task_key: 'clean_report_source', notebook_task: { notebook_path: base.notebookPath } }] }, null, 2);
        return { draft: draft('deployment-review', 'Review Databricks job pipeline draft', 'JobPipelineAgent', { ...base, jobJson }), artifacts: [artifact('notebook-review', 'Databricks job notebook review', base.notebookSource)] };
    }
}
exports.JobPipelineAgent = JobPipelineAgent;
class AdaptiveMetadataAgent {
    execute() {
        const payload = { catalog: 'main', schema: 'lakepilot_demo', table: 'clean_report_source', primaryKeys: ['customer_id', 'event_date'], watermarks: ['event_date'], incrementalStrategy: 'merge-on-primary-key-and-watermark', columns: [{ name: 'quality_status', type: 'string', description: 'Row-level data quality state.' }] };
        return { draft: draft('metadata-grid', 'Review metadata grid', 'AdaptiveMetadataAgent', payload), artifacts: [] };
    }
}
exports.AdaptiveMetadataAgent = AdaptiveMetadataAgent;
class ExternalConnectionAgent {
    execute(plan) {
        const payload = { sourceType: has(plan.intent.request, /github/) ? 'github' : 'external-source', sourceHint: plan.intent.request, connectionName: 'lakepilot_source_connection', secretRequirements: ['Store tokens in VS Code SecretStorage or Databricks secrets before use.'], ingestionNotes: ['No connection is opened by the core engine.', 'Review and approve credentials outside LakePilot drafts.'], configJson: JSON.stringify({ connection: 'lakepilot_source_connection', mode: 'review-only' }, null, 2) };
        return { draft: draft('external-connection-review', 'Review external connection draft', 'ExternalConnectionAgent', payload), artifacts: [] };
    }
}
exports.ExternalConnectionAgent = ExternalConnectionAgent;
class AdaptiveSyntheticDataAgent {
    execute() {
        return { artifacts: [artifact('csv-preview', 'Synthetic CSV preview', 'event_date,customer_id,amount,category\n2026-01-01,C-1,42.00,A')] };
    }
}
exports.AdaptiveSyntheticDataAgent = AdaptiveSyntheticDataAgent;
class AdaptivePowerBIAgent {
    execute(plan, context) {
        const report = context.businessReport;
        const baseColumns = (report?.detectedFields ?? []).map(field => ({ name: field.name, dataType: mapType(field.type), businessMeaning: field.businessMeaning }));
        const columns = [...baseColumns, { name: 'quality_status', dataType: 'string', businessMeaning: 'Generated quality classification for each row.' }];
        const numeric = columns.filter(column => ['int64', 'decimal', 'double'].includes(column.dataType));
        const tableName = context.cleanTable.table;
        const sqlEndpointQuery = `SELECT * FROM ${context.cleanTable.catalog}.${context.cleanTable.schema}.${context.cleanTable.table}`;
        const powerQueryM = `let\n  Source = Databricks.Catalogs("${context.workspaceHost}", "/sql/1.0/warehouses/<your-sql-warehouse-id>", [Catalog="${context.cleanTable.catalog}", Database="${context.cleanTable.schema}"]),\n  Table = Source{[Item="${context.cleanTable.table}",Schema="${context.cleanTable.schema}",Catalog="${context.cleanTable.catalog}"]}[Data]\nin\n  Table`;
        const measures = ['Record Count = COUNTROWS(clean_report_source)', ...numeric.flatMap(column => [`Total ${column.name} = SUM(clean_report_source[${column.name}])`, `Average ${column.name} = AVERAGE(clean_report_source[${column.name}])`])];
        const visualPlan = [
            { name: 'Record Count KPI', type: 'card', fields: ['Record Count'], intent: 'Show row volume.' },
            ...(columns.some(column => column.dataType === 'dateTime') ? [{ name: 'Trend Over Time', type: 'line', fields: ['event_date', numeric[0]?.name ?? 'Record Count'], intent: 'Track activity over time.' }] : []),
            { name: 'Top Contributors', type: 'bar', fields: ['category', numeric[0]?.name ?? 'Record Count'], intent: 'Rank key contributors.' },
            { name: 'Data Quality', type: 'donut', fields: ['quality_status', 'Record Count'], intent: 'Surface data quality mix.' }
        ];
        const tmdl = buildTmdl(tableName, columns, measures, powerQueryM);
        const payload = {
            businessSummary: report?.reportIntent ?? plan.intent.request,
            formatPriority: ['DirectQuery freshness', 'Semantic clarity', 'Deployment reviewability'],
            dataConnection: { connectivityMode: 'DirectQuery', connector: 'Databricks', serverHostname: context.workspaceHost, httpPath: '/sql/1.0/warehouses/<your-sql-warehouse-id>', catalog: context.cleanTable.catalog, schema: context.cleanTable.schema, table: context.cleanTable.table, sqlEndpointQuery, powerQueryM, notes: ['Confirm SQL warehouse id before publishing.', 'No network call is made by LakePilot core.'] },
            semanticModel: { tables: [{ name: tableName, columns }], relationships: [], measures, tmdl },
            visualPlan,
            reportPages: (report?.businessQuestions ?? ['Review the generated semantic model.']).map((question, index) => ({ name: `Page ${index + 1}`, businessQuestion: question, visuals: visualPlan.map(visual => visual.name) })),
            publishingRules: ['Publish only after credentials and SQL warehouse are approved.', 'Keep generated PBIP in source control for review.']
        };
        return { draft: draft('semantic-model-review', 'Review Power BI semantic model', 'AdaptivePowerBIAgent', payload), artifacts: [artifact('semantic-model-review', 'Power BI semantic model review', tmdl)] };
    }
}
exports.AdaptivePowerBIAgent = AdaptivePowerBIAgent;
function draftTypeFor(capability) {
    switch (capability) {
        case 'business-understanding': return 'business-report-review';
        case 'metadata': return 'metadata-grid';
        case 'databricks-assets': return 'deployment-review';
        case 'powerbi-assets': return 'semantic-model-review';
        case 'external-connection': return 'external-connection-review';
        case 'synthetic-data': return undefined;
    }
}
function titleFor(capability) { return capability.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' '); }
function rationaleFor(capability, request) { return `${capability} selected for request: ${request.slice(0, 120)}`; }
function mapType(type) { if (/int|long/.test(type))
    return 'int64'; if (/decimal|money|amount/.test(type))
    return 'decimal'; if (/double|float/.test(type))
    return 'double'; if (/date|time/.test(type))
    return 'dateTime'; if (/bool/.test(type))
    return 'boolean'; return 'string'; }
function buildTmdl(tableName, columns, measures, powerQueryM) {
    const columnText = columns.map(column => `\t\tcolumn ${column.name}\n\t\t\tdataType: ${column.dataType}\n\t\t\tsummarizeBy: none`).join('\n');
    const measureText = measures.map(measure => `\t\tmeasure '${measure.split(' = ')[0]}' = ${measure.split(' = ').slice(1).join(' = ')}`).join('\n');
    return `model LakePilot\n\ttable ${tableName}\n${columnText}\n${measureText}\n\t\tpartition ${tableName} = m\n\t\t\tmode: directQuery\n\t\t\tsource = DatabricksSource\n\nexpression DatabricksSource =\n\t${powerQueryM.replace(/\n/g, '\n\t')}`;
}
//# sourceMappingURL=adaptiveAgents.js.map