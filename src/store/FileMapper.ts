import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Maps source file URIs to their corresponding .aside JSON file paths and vice versa.
 */
export class FileMapper {
	private storageFolderName: string;

	constructor(storageFolderName: string = '.aside') {
		this.storageFolderName = storageFolderName;
	}

	/**
	 * Get the .aside JSON file URI for a given source file URI.
	 * e.g., workspace/src/app.ts → workspace/.aside/src/app.ts.json
	 */
	getAsidePath(sourceUri: vscode.Uri): vscode.Uri | undefined {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(sourceUri);
		if (!workspaceFolder) {
			return undefined;
		}

		const relativePath = vscode.workspace.asRelativePath(sourceUri, false);
		const asidePath = path.join(
			workspaceFolder.uri.fsPath,
			this.storageFolderName,
			`${relativePath}.json`
		);

		return vscode.Uri.file(asidePath);
	}

	/**
	 * Get the source file URI from a .aside JSON file URI.
	 * e.g., workspace/.aside/src/app.ts.json → workspace/src/app.ts
	 */
	getSourcePath(asideUri: vscode.Uri): vscode.Uri | undefined {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(asideUri);
		if (!workspaceFolder) {
			// The .aside folder might not be recognized as part of the workspace directly.
			// Try to find the workspace folder by checking parent directories.
			for (const folder of vscode.workspace.workspaceFolders ?? []) {
				const folderPath = folder.uri.fsPath;
				if (asideUri.fsPath.startsWith(folderPath)) {
					return this.resolveSourceFromWorkspace(asideUri, folder);
				}
			}
			return undefined;
		}

		return this.resolveSourceFromWorkspace(asideUri, workspaceFolder);
	}

	private resolveSourceFromWorkspace(
		asideUri: vscode.Uri,
		workspaceFolder: vscode.WorkspaceFolder
	): vscode.Uri | undefined {
		const asideDir = path.join(workspaceFolder.uri.fsPath, this.storageFolderName);
		const relativeToPart = path.relative(asideDir, asideUri.fsPath);

		if (relativeToPart.startsWith('..')) {
			return undefined; // Not inside the .aside folder
		}

		// Remove the .json extension to get the original relative path
		if (!relativeToPart.endsWith('.json')) {
			return undefined;
		}
		const originalRelative = relativeToPart.slice(0, -5); // remove ".json"
		const sourcePath = path.join(workspaceFolder.uri.fsPath, originalRelative);

		return vscode.Uri.file(sourcePath);
	}

	/**
	 * Get the storage folder URI for a workspace folder.
	 */
	getStorageFolder(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
		return vscode.Uri.file(
			path.join(workspaceFolder.uri.fsPath, this.storageFolderName)
		);
	}

	/**
	 * Get the glob pattern to watch for .aside file changes.
	 */
	getWatchPattern(workspaceFolder: vscode.WorkspaceFolder): vscode.RelativePattern {
		return new vscode.RelativePattern(
			workspaceFolder,
			`${this.storageFolderName}/**/*.json`
		);
	}

	updateStorageFolderName(name: string): void {
		this.storageFolderName = name;
	}
}
