import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';
import { FileMapper } from '../store/FileMapper';
import { AsideComment, AsideFileData, isFileComment } from '../types';

interface SearchResult {
	comment: AsideComment;
	sourceUri: vscode.Uri;
	relativePath: string;
}

export function registerSearchComment(
	context: vscode.ExtensionContext,
	store: CommentStore,
	fileMapper: FileMapper
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('asideComments.searchComment', async () => {
			const query = await vscode.window.showInputBox({
				prompt: 'Search comments by text',
				placeHolder: 'Enter search text...',
			});

			if (!query) {
				return;
			}

			const results = await searchComments(store, fileMapper, query);

			if (results.length === 0) {
				vscode.window.showInformationMessage(`No comments matching "${query}".`);
				return;
			}

			const items = results.map(r => {
				const location = isFileComment(r.comment)
					? 'file comment'
					: `line ${r.comment.lineStart + 1}`;

				return {
					label: r.comment.text,
					description: `${r.relativePath} — ${location}`,
					detail: `by ${r.comment.author}`,
					result: r,
				};
			});

			const picked = await vscode.window.showQuickPick(items, {
				placeHolder: `${results.length} result(s) for "${query}"`,
				matchOnDescription: true,
				matchOnDetail: true,
			});

			if (!picked) {
				return;
			}

			const { sourceUri, comment } = picked.result;
			const document = await vscode.workspace.openTextDocument(sourceUri);
			const editor = await vscode.window.showTextDocument(document);

			if (!isFileComment(comment)) {
				const line = Math.min(comment.lineStart, document.lineCount - 1);
				const range = new vscode.Range(line, 0, comment.lineEnd, 0);
				editor.selection = new vscode.Selection(line, 0, line, 0);
				editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
			}
		})
	);
}

async function searchComments(
	store: CommentStore,
	fileMapper: FileMapper,
	query: string
): Promise<SearchResult[]> {
	const lowerQuery = query.toLowerCase();
	const results: SearchResult[] = [];

	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const pattern = fileMapper.getWatchPattern(folder);

		const asideFiles = await vscode.workspace.findFiles(pattern);

		for (const asideUri of asideFiles) {
			const sourceUri = fileMapper.getSourcePath(asideUri);
			if (!sourceUri) {
				continue;
			}

			const comments = await store.getComments(sourceUri);
			const relativePath = vscode.workspace.asRelativePath(sourceUri, false);

			for (const comment of comments) {
				if (comment.text.toLowerCase().includes(lowerQuery)) {
					results.push({ comment, sourceUri, relativePath });
				}
			}
		}
	}

	return results;
}
