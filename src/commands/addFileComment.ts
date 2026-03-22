import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';
import { CommentsPanelProvider } from '../views/CommentsPanelProvider';

export function registerAddFileComment(
	context: vscode.ExtensionContext,
	store: CommentStore,
	panelProvider: CommentsPanelProvider
): void {
	const disposable = vscode.commands.registerCommand('asideComments.addFileComment', async (uri?: vscode.Uri) => {
		// When invoked from explorer/tab context menu, VS Code passes the URI.
		// When invoked from command palette/keyboard, fall back to active editor.
		const externalUri = !!uri;
		if (!uri) {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage('No active editor to add a comment to.');
				return;
			}
			uri = editor.document.uri;
		}

		// When the URI was provided externally (e.g. explorer/tab context menu),
		// explicitly set it so the panel targets the correct file.
		if (externalUri) {
			panelProvider.setCurrentUri(uri);
		}

		// Open the panel and wait for the webview to be ready
		await panelProvider.revealAndWaitForReady();

		// Send startAdd message with file-level sentinel values
		panelProvider.postMessage({
			type: 'startAdd',
			fileUri: uri.toString(),
			lineStart: -1,
			lineEnd: -1,
			lineLabel: 'File',
			anchorContent: '',
		});
	});

	context.subscriptions.push(disposable);
}
