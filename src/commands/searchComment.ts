import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';
import { FileMapper } from '../store/FileMapper';
import { CommentsPanelProvider } from '../views/CommentsPanelProvider';
import { AsideComment, isFileComment } from '../types';

interface SearchResult {
	comment: AsideComment;
	sourceUri: vscode.Uri;
	relativePath: string;
	isFolder: boolean;
}

export function registerSearchComment(
	context: vscode.ExtensionContext,
	store: CommentStore,
	fileMapper: FileMapper,
	panelProvider: CommentsPanelProvider
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
				const location = getResultLocation(r);

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

			const { sourceUri, comment, isFolder } = picked.result;

			if (isFolder) {
				panelProvider.setCurrentUri(sourceUri, true);
				await panelProvider.revealAndWaitForReady();
				return;
			}

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
			const matchingComments = comments.filter(comment =>
				comment.text.toLowerCase().includes(lowerQuery)
			);

			if (matchingComments.length === 0) {
				continue;
			}

			const isFolder = await isDirectory(sourceUri);

			for (const comment of matchingComments) {
				results.push({ comment, sourceUri, relativePath, isFolder });
			}
		}
	}

	return results;
}

function getResultLocation(result: SearchResult): string {
	if (result.isFolder) {
		return 'folder comment';
	}

	if (isFileComment(result.comment)) {
		return 'file comment';
	}

	return `line ${result.comment.lineStart + 1}`;
}

async function isDirectory(uri: vscode.Uri): Promise<boolean> {
	try {
		const stat = await vscode.workspace.fs.stat(uri);
		return (stat.type & vscode.FileType.Directory) !== 0;
	} catch {
		return false;
	}
}
