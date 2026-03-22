import * as path from 'path';
import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';

export function registerDeleteComment(
	context: vscode.ExtensionContext,
	store: CommentStore
): void {
	const disposable = vscode.commands.registerCommand(
		'asideComments.deleteComment',
		async (sourceUri?: vscode.Uri | string, commentId?: string) => {
			// Handle string URIs from command links in hover tooltips
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

			// If no specific comment ID, let user pick
			if (!commentId && editor) {
				const line = editor.selection.active.line;
				const lineComments = comments.filter(
					c => line >= c.lineStart && line <= c.lineEnd
				);

				const pool = lineComments.length > 0 ? lineComments : comments;

				if (pool.length === 1) {
					commentId = pool[0].id;
				} else {
					const picked = await vscode.window.showQuickPick(
						pool.map(c => ({
							label: c.text.substring(0, 80),
							description: c.lineStart === -1
								? `File: ${path.basename(uri.fsPath)}`
								: `Lines ${c.lineStart + 1}-${c.lineEnd + 1}`,
							id: c.id,
						})),
						{ placeHolder: 'Select a comment to delete' }
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

			const comment = comments.find(c => c.id === commentId);
			if (!comment) {
				return;
			}

			const confirmMsg = comment.lineStart === -1
				? `Delete comment from file ${path.basename(uri.fsPath)}?`
				: `Delete comment on lines ${comment.lineStart + 1}-${comment.lineEnd + 1}?`;
			const confirm = await vscode.window.showWarningMessage(
				confirmMsg,
				{ modal: true },
				'Delete'
			);

			if (confirm !== 'Delete') {
				return;
			}

			await store.deleteComment(uri, commentId);
		}
	);

	context.subscriptions.push(disposable);
}
