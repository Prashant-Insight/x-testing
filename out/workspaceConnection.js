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
exports.WorkspaceConnectionService = void 0;
const vscode = __importStar(require("vscode"));
class WorkspaceConnectionService {
    async discover() {
        const configured = vscode.workspace.getConfiguration('lakepilot').get('workspaceHost');
        if (configured)
            return { source: 'configuration', host: configured };
        const picked = await vscode.window.showInputBox({ title: 'Databricks workspace host', prompt: 'Enter a Databricks workspace host or leave blank for a review placeholder.', value: 'adb-placeholder.azuredatabricks.net' });
        return { source: picked ? 'user' : 'placeholder', host: picked || 'adb-placeholder.azuredatabricks.net' };
    }
}
exports.WorkspaceConnectionService = WorkspaceConnectionService;
//# sourceMappingURL=workspaceConnection.js.map