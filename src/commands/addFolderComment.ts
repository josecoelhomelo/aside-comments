import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';
import { CommentsPanelProvider } from '../views/CommentsPanelProvider';

export function registerAddFolderComment(
	context: vscode.ExtensionContext,
	store: CommentStore,
	panelProvider: CommentsPanelProvider
): void {
	const disposable = vscode.commands.registerCommand('asideComments.addFolderComment', async (uri?: vscode.Uri) => {
		if (!uri && panelProvider.isViewingFolder) {
			uri = panelProvider.uri;
		}
		if (!uri) {
			vscode.window.showWarningMessage('No folder selected.');
			return;
		}

		// Switch the panel to show this folder's comments
		panelProvider.setCurrentUri(uri, true);

		// Open the panel and wait for the webview to be ready
		await panelProvider.revealAndWaitForReady();

		// Send startAdd message with folder-level sentinel values
		panelProvider.postMessage({
			type: 'startAdd',
			fileUri: uri.toString(),
			lineStart: -1,
			lineEnd: -1,
			lineLabel: 'Folder',
			anchorContent: '',
		});
	});

	context.subscriptions.push(disposable);
}
