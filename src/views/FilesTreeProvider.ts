import * as vscode from 'vscode';
import * as path from 'path';
import { CommentStore } from '../store/CommentStore';
import { FileMapper } from '../store/FileMapper';

/**
 * Tree data provider that shows files with Aside comments,
 * grouped by workspace folder.
 */
export class FilesTreeProvider implements vscode.TreeDataProvider<FileTreeItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private readonly disposables: vscode.Disposable[] = [];

	constructor(
		private readonly store: CommentStore,
		private readonly fileMapper: FileMapper
	) {
		this.disposables.push(
			store.onDidChangeComments(() => this._onDidChangeTreeData.fire())
		);
	}

	async getTreeItem(element: FileTreeItem): Promise<vscode.TreeItem> {
		return element;
	}

	async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
		if (element) {
			return [];
		}

		const folders = vscode.workspace.workspaceFolders ?? [];
		const items: FileTreeItem[] = [];

		for (const folder of folders) {
			const storageFolder = this.fileMapper.getStorageFolder(folder);
			const pattern = new vscode.RelativePattern(storageFolder, '**/*.json');

			let asideFiles: vscode.Uri[];
			try {
				asideFiles = await vscode.workspace.findFiles(pattern);
			} catch {
				continue;
			}

			for (const asideUri of asideFiles) {
				const sourceUri = this.fileMapper.getSourcePath(asideUri);
				if (!sourceUri) {
					continue;
				}

				const comments = await this.store.getComments(sourceUri);
				if (comments.length === 0) {
					continue;
				}

				const relativePath = vscode.workspace.asRelativePath(sourceUri, folders.length > 1);
				const fileName = path.basename(sourceUri.fsPath);

				const item = new FileTreeItem(
					fileName,
					sourceUri,
					comments.length,
					relativePath
				);
				items.push(item);
			}
		}

		items.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
		return items;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		this._onDidChangeTreeData.dispose();
	}
}

class FileTreeItem extends vscode.TreeItem {
	constructor(
		label: string,
		public readonly sourceUri: vscode.Uri,
		commentCount: number,
		public readonly relativePath: string
	) {
		super(label, vscode.TreeItemCollapsibleState.None);

		this.description = relativePath !== label ? path.dirname(relativePath) : '';
		this.tooltip = `${relativePath} — ${commentCount} comment${commentCount === 1 ? '' : 's'}`;
		this.resourceUri = sourceUri;

		this.command = {
			command: 'vscode.open',
			title: 'Open File',
			arguments: [sourceUri],
		};

		this.contextValue = 'asideFileWithComments';
	}
}
