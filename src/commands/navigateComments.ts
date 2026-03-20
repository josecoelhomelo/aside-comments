import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';

export function registerNavigateComments(
	context: vscode.ExtensionContext,
	store: CommentStore
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('aside.nextComment', async () => {
			await navigate(store, 'next');
		}),
		vscode.commands.registerCommand('aside.previousComment', async () => {
			await navigate(store, 'previous');
		})
	);
}

async function navigate(store: CommentStore, direction: 'next' | 'previous'): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const allComments = await store.getComments(editor.document.uri);
	const comments = allComments.filter(c => c.lineStart >= 0);
	if (comments.length === 0) {
		vscode.window.showInformationMessage('No line-based comments to navigate to.');
		return;
	}

	const currentLine = editor.selection.active.line;
	const sorted = [...comments].sort((a, b) => a.lineStart - b.lineStart);

	let target;
	if (direction === 'next') {
		target = sorted.find(c => c.lineStart > currentLine);
		if (!target) {
			target = sorted[0]; // Wrap around
		}
	} else {
		target = [...sorted].reverse().find(c => c.lineStart < currentLine);
		if (!target) {
			target = sorted[sorted.length - 1]; // Wrap around
		}
	}

	if (target) {
		const range = new vscode.Range(target.lineStart, 0, target.lineEnd, 0);
		editor.selection = new vscode.Selection(target.lineStart, 0, target.lineStart, 0);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
	}
}
