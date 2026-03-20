import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';
import { CommentsPanelProvider } from '../views/CommentsPanelProvider';

export function registerAddComment(
	context: vscode.ExtensionContext,
	store: CommentStore,
	panelProvider: CommentsPanelProvider
): void {
	const disposable = vscode.commands.registerCommand('aside.addComment', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active editor to add a comment to.');
			return;
		}

		const selection = editor.selection;
		const lineStart = selection.start.line;
		const lineEnd = selection.end.line;

		// Capture anchor content before focus changes
		const lines: string[] = [];
		for (let i = lineStart; i <= lineEnd; i++) {
			lines.push(editor.document.lineAt(i).text);
		}
		const anchorContent = lines.join('\n');

		const lineLabel = lineStart === lineEnd
			? `Line ${lineStart + 1}`
			: `Lines ${lineStart + 1}-${lineEnd + 1}`;

		// Open the panel and wait for the webview to be ready
		await panelProvider.revealAndWaitForReady();

		// Now send the startAdd message
		panelProvider.postMessage({
			type: 'startAdd',
			lineStart,
			lineEnd,
			lineLabel,
			anchorContent,
		});
	});

	context.subscriptions.push(disposable);
}
