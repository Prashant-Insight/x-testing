import * as vscode from 'vscode';
import { DatabricksWorkspaceConnection } from './domain';

export class WorkspaceConnectionService {
  public async discover(): Promise<DatabricksWorkspaceConnection> {
    const configured = vscode.workspace.getConfiguration('lakepilot').get<string>('workspaceHost');
    if (configured) return { source: 'configuration', host: configured };
    const picked = await vscode.window.showInputBox({ title: 'Databricks workspace host', prompt: 'Enter a Databricks workspace host or leave blank for a review placeholder.', value: 'adb-placeholder.azuredatabricks.net' });
    return { source: picked ? 'user' : 'placeholder', host: picked || 'adb-placeholder.azuredatabricks.net' };
  }
}
