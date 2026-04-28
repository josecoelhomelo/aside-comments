import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Maps source file URIs to their corresponding .aside JSON file paths and vice versa.
 */
export class FileMapper {
	private storageFolderName: string;
	private readonly storageFolderExists: (storageFolderPath: string) => boolean;

	constructor(
		storageFolderName: string = '.aside',
		storageFolderExists: (storageFolderPath: string) => boolean = (storageFolderPath) => {
			try {
				return fs.existsSync(storageFolderPath) && fs.statSync(storageFolderPath).isDirectory();
			} catch {
				return false;
			}
		}
	) {
		this.storageFolderName = storageFolderName;
		this.storageFolderExists = storageFolderExists;
	}

	/**
	 * Get the .aside JSON file URI for a given source file URI.
	 * e.g., workspace/src/app.ts → workspace/.aside/src/app.ts.json
	 */
	getAsidePath(sourceUri: vscode.Uri): vscode.Uri | undefined {
		const workspaceFolder = this.getContainingWorkspaceFolder(sourceUri);
		if (!workspaceFolder) {
			return undefined;
		}

		const storageRoot = this.findStorageRootForSource(sourceUri, workspaceFolder);
		const relativePath = path.relative(storageRoot, sourceUri.fsPath);
		const asidePath = path.join(
			storageRoot,
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
		const workspaceFolder = this.getContainingWorkspaceFolder(asideUri);
		if (!workspaceFolder) {
			// The .aside folder might not be recognized as part of the workspace directly.
			// Try to find the workspace folder by checking parent directories.
			for (const folder of vscode.workspace.workspaceFolders ?? []) {
				if (this.isPathInsideOrEqual(asideUri.fsPath, folder.uri.fsPath)) {
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
		const storageRoot = this.findStorageRootForAside(asideUri, workspaceFolder);
		if (!storageRoot) {
			return undefined;
		}

		const asideDir = path.join(storageRoot, this.storageFolderName);
		const relativeToPart = path.relative(asideDir, asideUri.fsPath);

		if (!this.isRelativePathInside(relativeToPart)) {
			return undefined; // Not inside the .aside folder
		}

		// Remove the .json extension to get the original relative path
		if (!relativeToPart.endsWith('.json')) {
			return undefined;
		}
		const originalRelative = relativeToPart.slice(0, -5); // remove ".json"
		const sourcePath = path.join(storageRoot, originalRelative);

		return vscode.Uri.file(sourcePath);
	}

	private findStorageRootForSource(
		sourceUri: vscode.Uri,
		workspaceFolder: vscode.WorkspaceFolder
	): string {
		const workspaceRoot = workspaceFolder.uri.fsPath;
		let candidate = sourceUri.fsPath;

		while (this.isPathInsideOrEqual(candidate, workspaceRoot)) {
			const storagePath = path.join(candidate, this.storageFolderName);
			if (this.storageFolderExists(storagePath)) {
				return candidate;
			}

			const parent = path.dirname(candidate);
			if (parent === candidate) {
				break;
			}
			candidate = parent;
		}

		return workspaceRoot;
	}

	private findStorageRootForAside(
		asideUri: vscode.Uri,
		workspaceFolder: vscode.WorkspaceFolder
	): string | undefined {
		const workspaceRoot = workspaceFolder.uri.fsPath;
		let candidate = path.dirname(asideUri.fsPath);

		while (this.isPathInsideOrEqual(candidate, workspaceRoot)) {
			const storagePath = path.join(candidate, this.storageFolderName);
			if (this.isPathInsideOrEqual(asideUri.fsPath, storagePath)) {
				return candidate;
			}

			const parent = path.dirname(candidate);
			if (parent === candidate) {
				break;
			}
			candidate = parent;
		}

		return undefined;
	}

	private getContainingWorkspaceFolder(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const matchingFolder = folders
			.filter(folder => this.isPathInsideOrEqual(uri.fsPath, folder.uri.fsPath))
			.sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length)[0];

		return matchingFolder ?? vscode.workspace.getWorkspaceFolder(uri);
	}

	private isPathInsideOrEqual(childPath: string, parentPath: string): boolean {
		const relative = path.relative(parentPath, childPath);
		return relative === '' || this.isRelativePathInside(relative);
	}

	private isRelativePathInside(relativePath: string): boolean {
		return relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
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
			`**/${this.storageFolderName}/**/*.json`
		);
	}

	updateStorageFolderName(name: string): void {
		this.storageFolderName = name;
	}
}
