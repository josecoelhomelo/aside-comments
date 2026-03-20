import * as vscode from 'vscode';
import { FileMapper } from './store/FileMapper';
import { CommentStore } from './store/CommentStore';
import { LineTracker } from './store/LineTracker';
import { DecorationManager } from './decorations/DecorationManager';
import { AsideFileDecorationProvider } from './decorations/FileDecorationProvider';
import { CommentsPanelProvider } from './views/CommentsPanelProvider';
import { registerAddComment } from './commands/addComment';
import { registerEditComment } from './commands/editComment';
import { registerDeleteComment } from './commands/deleteComment';
import { registerNavigateComments } from './commands/navigateComments';
import { registerAddFileComment } from './commands/addFileComment';

export function activate(context: vscode.ExtensionContext): void {
	const config = vscode.workspace.getConfiguration('aside');
	const storagePath = config.get<string>('storagePath', '.aside');

	// Core services
	const fileMapper = new FileMapper(storagePath);
	const store = new CommentStore(fileMapper);
	const lineTracker = new LineTracker(store);

	// Decorations (vertical line indicators, minimap colors, background highlights)
	const decorationManager = new DecorationManager(context, store);

	// File decorations (badge in Explorer / Open Editors for files with comments)
	const fileDecorationProvider = new AsideFileDecorationProvider(store);
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(fileDecorationProvider),
		fileDecorationProvider
	);

	// Side panel (WebviewViewProvider)
	const panelProvider = new CommentsPanelProvider(context, store);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			CommentsPanelProvider.viewType,
			panelProvider
		)
	);

	// Toggle panel command — opens/focuses the comments panel
	context.subscriptions.push(
		vscode.commands.registerCommand('aside.togglePanel', () => {
			vscode.commands.executeCommand('aside.commentsPanel.focus');
		})
	);

	// Register commands — pass panelProvider so addComment can queue messages
	registerAddComment(context, store, panelProvider);
	registerEditComment(context, store, panelProvider);
	registerDeleteComment(context, store);
	registerNavigateComments(context, store);
	registerAddFileComment(context, store, panelProvider);

	// Update hasComments context for editor title bar buttons
	async function updateHasCommentsContext() {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const comments = await store.getComments(editor.document.uri);
			const hasLineComments = comments.some(c => c.lineStart >= 0);
			vscode.commands.executeCommand('setContext', 'aside.hasComments', comments.length > 0);
			vscode.commands.executeCommand('setContext', 'aside.hasLineComments', hasLineComments);
		} else {
			vscode.commands.executeCommand('setContext', 'aside.hasComments', false);
			vscode.commands.executeCommand('setContext', 'aside.hasLineComments', false);
		}
	}

	store.onDidChangeComments(() => updateHasCommentsContext());
	vscode.window.onDidChangeActiveTextEditor(() => updateHasCommentsContext(), null, context.subscriptions);
	updateHasCommentsContext();

	// Line tracking: adjust comment positions on document changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.contentChanges.length > 0) {
				lineTracker.handleDocumentChange(event);
			}
		})
	);

	// Persist comments when a document is saved
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((document) => {
			store.save(document.uri);
		})
	);

	// Handle file renames — move .aside JSON files accordingly
	context.subscriptions.push(
		vscode.workspace.onDidRenameFiles(async (event) => {
			for (const { oldUri, newUri } of event.files) {
				const oldAsidePath = fileMapper.getAsidePath(oldUri);
				const newAsidePath = fileMapper.getAsidePath(newUri);
				if (!oldAsidePath || !newAsidePath) {
					continue;
				}

				try {
					await vscode.workspace.fs.stat(oldAsidePath);
					const path = require('path');
					const newDir = vscode.Uri.file(
						newAsidePath.fsPath.substring(0, newAsidePath.fsPath.lastIndexOf(path.sep))
					);
					await vscode.workspace.fs.createDirectory(newDir);
					await vscode.workspace.fs.rename(oldAsidePath, newAsidePath);
					store.invalidateCache(oldUri);
				} catch {
					// Old aside file doesn't exist — nothing to move
				}
			}
		})
	);

	// Handle file deletions — clean up .aside JSON files
	context.subscriptions.push(
		vscode.workspace.onDidDeleteFiles(async (event) => {
			for (const uri of event.files) {
				const asidePath = fileMapper.getAsidePath(uri);
				if (!asidePath) {
					continue;
				}

				try {
					await vscode.workspace.fs.delete(asidePath);
					store.invalidateCache(uri);
				} catch {
					// Aside file doesn't exist — nothing to clean up
				}
			}
		})
	);

	// FileSystemWatcher: reload comments when .aside files change externally
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const watcher = vscode.workspace.createFileSystemWatcher(
			fileMapper.getWatchPattern(folder)
		);

		watcher.onDidChange((uri) => store.reloadFromAsideUri(uri));
		watcher.onDidCreate((uri) => store.reloadFromAsideUri(uri));
		watcher.onDidDelete((uri) => {
			const sourceUri = fileMapper.getSourcePath(uri);
			if (sourceUri) {
				store.invalidateCache(sourceUri);
				decorationManager.refreshForUri(sourceUri);
			}
		});

		context.subscriptions.push(watcher);
	}

	// Fuzzy re-attach when opening a document with stale comments
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(async (document) => {
			const isStale = await store.isStale(document.uri);
			if (!isStale) {
				return;
			}

			const comments = await store.getComments(document.uri);
			if (comments.length === 0) {
				return;
			}

			const threshold = config.get<number>('fuzzyMatchThreshold', 0.7);
			const changed = await lineTracker.fuzzyReattach(document, comments, threshold);
			if (changed) {
				store.updateCommentLines(document.uri, comments);
			}
		})
	);

	// React to configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('aside.storagePath')) {
				const newPath = vscode.workspace
					.getConfiguration('aside')
					.get<string>('storagePath', '.aside');
				fileMapper.updateStorageFolderName(newPath);
			}
		})
	);

	// On first activation, attempt to move the comments panel to the secondary side bar.
	// This is best-effort; if it fails the user can drag the panel manually.
	const isFirstRun = !context.globalState.get<boolean>('aside.movedToSecondarySidebar');
	if (isFirstRun) {
		context.globalState.update('aside.movedToSecondarySidebar', true);
		setTimeout(async () => {
			try {
				await vscode.commands.executeCommand('aside.commentsPanel.focus');
				await vscode.commands.executeCommand(
					'workbench.action.moveActivityBarEntry',
					{ from: 'workbench.view.extension.aside', to: 'auxiliarybar' }
				);
			} catch {
				// Best effort — user can right-click the Aside icon and choose
				// "Move to Secondary Side Bar" if automatic move did not work.
			}
		}, 2000);
	}

	// Save all on deactivation
	context.subscriptions.push({
		dispose: () => {
			store.saveAll();
			store.dispose();
			decorationManager.dispose();
		},
	});
}

export function deactivate(): void {
	// Cleanup handled by disposables
}
