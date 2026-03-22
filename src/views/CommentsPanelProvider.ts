import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { CommentStore } from '../store/CommentStore';
import { getPanelHtml } from './panelHtml';

export class CommentsPanelProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'asideComments.commentsPanel';

	private view?: vscode.WebviewView;
	private _visible = false;
	private currentUri?: vscode.Uri;
	private viewingFolder = false;
	private webviewReady = false;
	private readyCallbacks: Array<() => void> = [];

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly store: CommentStore
	) {
		// Refresh when comments change
		store.onDidChangeComments((event) => {
			if (this.currentUri?.fsPath === event.uri.fsPath) {
				this.sendComments();
			}
		});

		// Refresh when active editor changes
		vscode.window.onDidChangeActiveTextEditor(
			(editor) => {
				if (editor) {
					this.currentUri = editor.document.uri;
					this.exitFolderMode();
					this.sendComments();
				}
			},
			null,
			context.subscriptions
		);

		// When viewing folder comments, switch back to file on any editor interaction
		vscode.window.onDidChangeTextEditorSelection(
			(event) => {
				if (this.viewingFolder && event.textEditor === vscode.window.activeTextEditor) {
					this.currentUri = event.textEditor.document.uri;
					this.exitFolderMode();
					this.sendComments();
				}
			},
			null,
			context.subscriptions
		);
	}

	get visible(): boolean {
		return this._visible;
	}

	get isViewingFolder(): boolean {
		return this.viewingFolder;
	}

	get uri(): vscode.Uri | undefined {
		return this.currentUri;
	}

	/**
	 * Reveal the panel and wait until the webview is ready to receive messages.
	 */
	async revealAndWaitForReady(timeout = 3000): Promise<void> {
		await vscode.commands.executeCommand('asideComments.commentsPanel.focus');

		if (this.webviewReady) {
			return;
		}

		return new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				resolve(); // resolve anyway after timeout
			}, timeout);

			this.readyCallbacks.push(() => {
				clearTimeout(timer);
				resolve();
			});
		});
	}

	/**
	 * Switch the panel to display comments for a specific URI (file or folder).
	 */
	setCurrentUri(uri: vscode.Uri, isFolder = false): void {
		this.currentUri = uri;
		this.viewingFolder = isFolder;
		vscode.commands.executeCommand('setContext', 'asideComments.viewingFolder', isFolder);
		this.sendViewMode();
		this.sendComments();
	}

	private exitFolderMode(): void {
		if (!this.viewingFolder) {
			return;
		}
		this.viewingFolder = false;
		vscode.commands.executeCommand('setContext', 'asideComments.viewingFolder', false);
		this.sendViewMode();
	}

	private sendViewMode(): void {
		if (this.view && this.webviewReady) {
			this.view.webview.postMessage({
				type: 'updateViewMode',
				isFolder: this.viewingFolder,
			});
		}
	}

	/**
	 * Post a message to the webview. Must be called after revealAndWaitForReady.
	 */
	postMessage(message: any): void {
		if (this.view) {
			this.view.webview.postMessage(message);
		}
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this.view = webviewView;
		this.webviewReady = false;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};

		const nonce = crypto.randomBytes(16).toString('hex');
		const cspSource = webviewView.webview.cspSource;
		webviewView.webview.html = getPanelHtml(nonce, cspSource);

		webviewView.webview.onDidReceiveMessage(
			async (message) => {
				if (message.type === 'ready') {
					this.webviewReady = true;
					// Send initial comments
					await this.sendComments();
					// Notify all waiters
					for (const cb of this.readyCallbacks) {
						cb();
					}
					this.readyCallbacks = [];
					return;
				}

				if (!this.currentUri) {
					return;
				}

				switch (message.type) {
					case 'scrollTo':
						if (message.lineStart >= 0 && message.lineEnd >= 0) {
							this.scrollToLine(message.lineStart, message.lineEnd);
						}
						break;
					case 'delete':
						await vscode.commands.executeCommand(
							'asideComments.deleteComment',
							this.currentUri,
							message.commentId
						);
						break;
					case 'add':
						await this.store.addComment(
							this.currentUri,
							message.lineStart,
							message.lineEnd,
							message.text,
							message.anchorContent,
							message.color
						);
						break;
					case 'update':
						await this.store.updateComment(
							this.currentUri,
							message.commentId,
							message.text,
							message.color
						);
						break;
				}
			},
			null,
			this.context.subscriptions
		);

		webviewView.onDidChangeVisibility(() => {
			this._visible = webviewView.visible;
			if (webviewView.visible) {
				this.sendComments();
			}
		});

		this._visible = true;

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			this.currentUri = editor.document.uri;
		}
	}

	private async sendComments(): Promise<void> {
		if (!this.view || !this.webviewReady) {
			return;
		}

		const comments = this.currentUri
			? await this.store.getComments(this.currentUri)
			: [];

		this.view.webview.postMessage({
			type: 'updateComments',
			comments,
		});
	}

	private scrollToLine(lineStart: number, lineEnd: number): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const range = new vscode.Range(lineStart, 0, lineEnd, 0);
		editor.selection = new vscode.Selection(lineStart, 0, lineStart, 0);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
	}
}
