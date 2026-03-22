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
			return element.children;
		}

		const folders = vscode.workspace.workspaceFolders ?? [];
		const allItems: { sourceUri: vscode.Uri; commentCount: number; isFolder: boolean; relativePath: string; fileName: string }[] = [];

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
				if (!sourceUri) continue;

				const comments = await this.store.getComments(sourceUri);
				if (comments.length === 0) continue;

				let isFolder = false;
				try {
					const stat = await vscode.workspace.fs.stat(sourceUri);
					isFolder = (stat.type & vscode.FileType.Directory) !== 0;
				} catch {
					// default to file
				}

				const relativePath = vscode.workspace.asRelativePath(sourceUri, folders.length > 1);
				const fileName = path.basename(sourceUri.fsPath);

				allItems.push({ sourceUri, commentCount: comments.length, isFolder, relativePath, fileName });
			}
		}

		// Build a map of folder fsPaths for quick lookup
		const folderMap = new Map<string, typeof allItems[0]>();
		for (const item of allItems) {
			if (item.isFolder) {
				folderMap.set(item.sourceUri.fsPath, item);
			}
		}

		// Separate files into those belonging to commented folders and orphans
		const folderChildren = new Map<string, FileTreeItem[]>();
		const orphanFiles: FileTreeItem[] = [];

		for (const item of allItems) {
			if (item.isFolder) continue;

			const parentDir = path.dirname(item.sourceUri.fsPath);
			if (folderMap.has(parentDir)) {
				if (!folderChildren.has(parentDir)) {
					folderChildren.set(parentDir, []);
				}
				folderChildren.get(parentDir)!.push(
					new FileTreeItem(item.fileName, item.sourceUri, item.commentCount, item.relativePath, false)
				);
			} else {
				orphanFiles.push(
					new FileTreeItem(item.fileName, item.sourceUri, item.commentCount, item.relativePath, false)
				);
			}
		}

		// Build folder items with their children
		const folderItems: FileTreeItem[] = [];
		for (const item of allItems) {
			if (!item.isFolder) continue;
			const children = (folderChildren.get(item.sourceUri.fsPath) || []).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
			folderItems.push(
				new FileTreeItem(item.fileName, item.sourceUri, item.commentCount, item.relativePath, true, children)
			);
		}

		// Combine and sort
		const result = [...folderItems, ...orphanFiles];
		result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
		return result;
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
	public readonly children: FileTreeItem[];

	constructor(
		label: string,
		public readonly sourceUri: vscode.Uri,
		commentCount: number,
		public readonly relativePath: string,
		isFolder: boolean,
		children: FileTreeItem[] = []
	) {
		super(label, isFolder && children.length > 0
			? vscode.TreeItemCollapsibleState.Expanded
			: vscode.TreeItemCollapsibleState.None);

		this.children = children;
		this.tooltip = `${relativePath} — ${commentCount} comment${commentCount === 1 ? '' : 's'}`;

		if (isFolder) {
			this.iconPath = new vscode.ThemeIcon('folder');
			this.description = commentCount + ' comment' + (commentCount === 1 ? '' : 's');
			this.command = {
				command: 'asideComments.viewFolderComments',
				title: 'View Folder Comments',
				arguments: [sourceUri],
			};
			this.contextValue = 'asideFolderWithComments';
		} else {
			const dir = relativePath !== label ? path.dirname(relativePath) : '';
			this.description = dir ? `${dir} · ${commentCount} comment${commentCount === 1 ? '' : 's'}` : `${commentCount} comment${commentCount === 1 ? '' : 's'}`;
			this.command = {
				command: 'asideComments.openFileComments',
				title: 'Open File',
				arguments: [sourceUri],
			};
			this.contextValue = 'asideFileWithComments';
		}
	}
}
