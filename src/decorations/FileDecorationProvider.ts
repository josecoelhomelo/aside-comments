import * as vscode from 'vscode';
import { CommentStore } from '../store/CommentStore';

/**
 * Adds a badge decoration next to files that have Aside comments
 * in the Explorer and Open Editors panels.
 */
export class AsideFileDecorationProvider implements vscode.FileDecorationProvider {
	private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

	private readonly disposables: vscode.Disposable[] = [];
	private enabled: boolean;

	constructor(private readonly store: CommentStore) {
		this.enabled = vscode.workspace
			.getConfiguration('asideComments')
			.get<boolean>('showExplorerBadges', true);

		this.disposables.push(
			store.onDidChangeComments((event) => {
				this._onDidChangeFileDecorations.fire(event.uri);
			}),
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration('asideComments.showExplorerBadges')) {
					this.enabled = vscode.workspace
						.getConfiguration('asideComments')
						.get<boolean>('showExplorerBadges', true);
					this._onDidChangeFileDecorations.fire(undefined);
				}
			})
		);
	}

	async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
		if (!this.enabled || uri.scheme !== 'file') {
			return undefined;
		}

		const comments = await this.store.getComments(uri);
		if (comments.length === 0) {
			return undefined;
		}

		return new vscode.FileDecoration(
			'🗨',
			'Aside: Has comments',
			new vscode.ThemeColor('asideComments.indicatorColor')
		);
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		this._onDidChangeFileDecorations.dispose();
	}
}
