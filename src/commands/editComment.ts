import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';
import { CommentsPanelProvider } from '../views/CommentsPanelProvider';

export function registerEditComment(
	context: vscode.ExtensionContext,
	store: CommentStore,
	panelProvider: CommentsPanelProvider
): void {
	const disposable = vscode.commands.registerCommand(
		'asideComments.editComment',
		async (sourceUri?: vscode.Uri | string, commentId?: string) => {
			if (typeof sourceUri === 'string') {
				sourceUri = vscode.Uri.parse(sourceUri);
			}

			const editor = vscode.window.activeTextEditor;
			const uri = sourceUri ?? editor?.document.uri;
			if (!uri) {
				return;
			}

			const comments = await store.getComments(uri);
			if (comments.length === 0) {
				vscode.window.showInformationMessage('No comments in this file.');
				return;
			}

			if (!commentId && editor) {
				const line = editor.selection.active.line;
				const lineComments = comments.filter(
					c => line >= c.lineStart && line <= c.lineEnd
				);

				if (lineComments.length === 1) {
					commentId = lineComments[0].id;
				} else if (lineComments.length > 1) {
					const picked = await vscode.window.showQuickPick(
						lineComments.map(c => ({
							label: c.text.substring(0, 80),
							description: `Lines ${c.lineStart + 1}-${c.lineEnd + 1}`,
							id: c.id,
						})),
						{ placeHolder: 'Select a comment to edit' }
					);
					if (!picked) {
						return;
					}
					commentId = picked.id;
				} else {
					const picked = await vscode.window.showQuickPick(
						comments.map(c => ({
							label: c.text.substring(0, 80),
							description: `Lines ${c.lineStart + 1}-${c.lineEnd + 1}`,
							id: c.id,
						})),
						{ placeHolder: 'Select a comment to edit' }
					);
					if (!picked) {
						return;
					}
					commentId = picked.id;
				}
			}

			if (!commentId) {
				return;
			}

			await panelProvider.revealAndWaitForReady();

			panelProvider.postMessage({
				type: 'startEdit',
				commentId,
			});
		}
	);

	context.subscriptions.push(disposable);
}
