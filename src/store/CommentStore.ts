import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as os from 'os';
import { AsideComment, AsideFileData, CommentChangeEvent, ASIDE_FILE_VERSION, DEFAULT_COMMENT_COLOR } from '../types';
import { FileMapper } from './FileMapper';

export class CommentStore {
	private cache = new Map<string, AsideComment[]>(); // keyed by source file fsPath
	private dirty = new Set<string>(); // source file fsPaths with unsaved changes
	private saveTimers = new Map<string, NodeJS.Timeout>();
	private cachedAuthor: string | undefined;

	private readonly _onDidChangeComments = new vscode.EventEmitter<CommentChangeEvent>();
	readonly onDidChangeComments = this._onDidChangeComments.event;

	constructor(private readonly fileMapper: FileMapper) {}

	/**
	 * Get all comments for a source file. Loads from disk if not cached.
	 */
	async getComments(sourceUri: vscode.Uri): Promise<AsideComment[]> {
		const key = sourceUri.fsPath;
		if (this.cache.has(key)) {
			return this.cache.get(key)!;
		}

		const comments = await this.loadFromDisk(sourceUri);
		this.cache.set(key, comments);
		return comments;
	}

	/**
	 * Add a new comment to a source file.
	 */
	async addComment(
		sourceUri: vscode.Uri,
		lineStart: number,
		lineEnd: number,
		text: string,
		anchorContent: string,
		color?: string
	): Promise<AsideComment> {
		const comments = await this.getComments(sourceUri);
		const author = await this.getAuthor();
		const now = new Date().toISOString();

		const comment: AsideComment = {
			id: crypto.randomUUID(),
			lineStart,
			lineEnd,
			text,
			author,
			createdAt: now,
			updatedAt: now,
			anchorContent,
			color: color || DEFAULT_COMMENT_COLOR,
		};

		comments.push(comment);
		comments.sort((a, b) => a.lineStart - b.lineStart);

		this.markDirty(sourceUri);
		this.fireChange(sourceUri, comments);
		this.scheduleSave(sourceUri);

		return comment;
	}

	/**
	 * Update an existing comment's text and/or color.
	 */
	async updateComment(sourceUri: vscode.Uri, commentId: string, newText: string, newColor?: string): Promise<boolean> {
		const comments = await this.getComments(sourceUri);
		const comment = comments.find(c => c.id === commentId);
		if (!comment) {
			return false;
		}

		comment.text = newText;
		comment.updatedAt = new Date().toISOString();
		if (newColor) {
			comment.color = newColor;
		}

		this.markDirty(sourceUri);
		this.fireChange(sourceUri, comments);
		this.scheduleSave(sourceUri);

		return true;
	}

	/**
	 * Delete a comment by ID.
	 */
	async deleteComment(sourceUri: vscode.Uri, commentId: string): Promise<boolean> {
		const comments = await this.getComments(sourceUri);
		const index = comments.findIndex(c => c.id === commentId);
		if (index === -1) {
			return false;
		}

		comments.splice(index, 1);

		this.markDirty(sourceUri);
		this.fireChange(sourceUri, comments);
		this.scheduleSave(sourceUri);

		return true;
	}

	/**
	 * Update comment line positions (called by LineTracker).
	 */
	updateCommentLines(sourceUri: vscode.Uri, comments: AsideComment[]): void {
		this.cache.set(sourceUri.fsPath, comments);
		this.markDirty(sourceUri);
		this.fireChange(sourceUri, comments);
		this.scheduleSave(sourceUri);
	}

	/**
	 * Persist comments for a source file to disk immediately.
	 */
	async save(sourceUri: vscode.Uri): Promise<void> {
		const key = sourceUri.fsPath;
		const comments = this.cache.get(key);
		if (!comments) {
			return;
		}

		// Clear any pending debounced save
		const timer = this.saveTimers.get(key);
		if (timer) {
			clearTimeout(timer);
			this.saveTimers.delete(key);
		}

		const asideUri = this.fileMapper.getAsidePath(sourceUri);
		if (!asideUri) {
			return;
		}

		// Update anchor content from current file
		try {
			const document = await vscode.workspace.openTextDocument(sourceUri);
			for (const comment of comments) {
				if (comment.lineStart === -1 && comment.lineEnd === -1) {
					continue;
				}

				const startLine = Math.max(0, comment.lineStart);
				const endLine = Math.min(document.lineCount - 1, comment.lineEnd);
				const lines: string[] = [];
				for (let i = startLine; i <= endLine; i++) {
					lines.push(document.lineAt(i).text);
				}
				comment.anchorContent = lines.join('\n');
			}
		} catch {
			// File might not be open; keep existing anchorContent
		}

		if (comments.length === 0) {
			// Delete the aside file if no comments remain
			try {
				await vscode.workspace.fs.delete(asideUri);
			} catch {
				// File might not exist
			}
			this.dirty.delete(key);
			return;
		}

		// Compute file hash
		let fileHash = '';
		try {
			const document = await vscode.workspace.openTextDocument(sourceUri);
			fileHash = crypto.createHash('sha256').update(document.getText()).digest('hex');
		} catch {
			// Best effort
		}

		const data: AsideFileData = {
			version: ASIDE_FILE_VERSION,
			fileHash,
			comments,
		};

		const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');

		// Ensure directory exists
		const dirUri = vscode.Uri.file(
			asideUri.fsPath.substring(0, asideUri.fsPath.lastIndexOf(require('path').sep))
		);
		try {
			await vscode.workspace.fs.createDirectory(dirUri);
		} catch {
			// Directory might already exist
		}

		await vscode.workspace.fs.writeFile(asideUri, content);
		this.dirty.delete(key);
	}

	/**
	 * Save all dirty files.
	 */
	async saveAll(): Promise<void> {
		const dirtyKeys = [...this.dirty];
		for (const key of dirtyKeys) {
			await this.save(vscode.Uri.file(key));
		}
	}

	/**
	 * Reload comments from disk for a specific source file (e.g., after external change).
	 */
	async reloadFromDisk(sourceUri: vscode.Uri): Promise<void> {
		const comments = await this.loadFromDisk(sourceUri);
		this.cache.set(sourceUri.fsPath, comments);
		this.dirty.delete(sourceUri.fsPath);
		this.fireChange(sourceUri, comments);
	}

	/**
	 * Reload from an aside file URI (used by FileSystemWatcher).
	 */
	async reloadFromAsideUri(asideUri: vscode.Uri): Promise<void> {
		const sourceUri = this.fileMapper.getSourcePath(asideUri);
		if (sourceUri) {
			await this.reloadFromDisk(sourceUri);
		}
	}

	/**
	 * Invalidate cache for a source file (e.g., after file rename).
	 */
	invalidateCache(sourceUri: vscode.Uri): void {
		const key = sourceUri.fsPath;
		this.cache.delete(key);
		this.dirty.delete(key);
		const timer = this.saveTimers.get(key);
		if (timer) {
			clearTimeout(timer);
			this.saveTimers.delete(key);
		}
	}

	/**
	 * Check if a source file has a stored file hash that differs from current content.
	 */
	async isStale(sourceUri: vscode.Uri): Promise<boolean> {
		const asideUri = this.fileMapper.getAsidePath(sourceUri);
		if (!asideUri) {
			return false;
		}

		try {
			const raw = await vscode.workspace.fs.readFile(asideUri);
			const data: AsideFileData = JSON.parse(Buffer.from(raw).toString('utf-8'));
			if (!data.fileHash) {
				return true;
			}

			const document = await vscode.workspace.openTextDocument(sourceUri);
			const currentHash = crypto.createHash('sha256').update(document.getText()).digest('hex');
			return data.fileHash !== currentHash;
		} catch {
			return false;
		}
	}

	private async loadFromDisk(sourceUri: vscode.Uri): Promise<AsideComment[]> {
		const asideUri = this.fileMapper.getAsidePath(sourceUri);
		if (!asideUri) {
			return [];
		}

		try {
			const raw = await vscode.workspace.fs.readFile(asideUri);
			const data: AsideFileData = JSON.parse(Buffer.from(raw).toString('utf-8'));
			return data.comments ?? [];
		} catch {
			return [];
		}
	}

	private async getAuthor(): Promise<string> {
		// Check configured author first
		const configured = vscode.workspace.getConfiguration('asideComments').get<string>('author');
		if (configured) {
			return configured;
		}

		// Return cached author if available
		if (this.cachedAuthor) {
			return this.cachedAuthor;
		}

		// Try Microsoft auth
		try {
			const session = await vscode.authentication.getSession('microsoft', ['openid', 'profile'], { createIfNone: false });
			if (session?.account?.label) {
				this.cachedAuthor = session.account.label;
				return this.cachedAuthor;
			}
		} catch {
			// Microsoft auth not available
		}

		// Try GitHub auth
		try {
			const session = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: false });
			if (session?.account?.label) {
				this.cachedAuthor = session.account.label;
				return this.cachedAuthor;
			}
		} catch {
			// GitHub auth not available
		}

		// Try GitHub auth with minimal scopes
		try {
			const session = await vscode.authentication.getSession('github', [], { createIfNone: false });
			if (session?.account?.label) {
				this.cachedAuthor = session.account.label;
				return this.cachedAuthor;
			}
		} catch {
			// Not available
		}

		// Try git config user.name via shell
		try {
			const cp = require('child_process');
			const gitName: string = cp.execSync('git config user.name', { encoding: 'utf-8', timeout: 2000 }).trim();
			if (gitName) {
				this.cachedAuthor = gitName;
				return gitName;
			}
		} catch {
			// git not available
		}

		// Fallback to OS username
		return os.userInfo().username;
	}

	private markDirty(sourceUri: vscode.Uri): void {
		this.dirty.add(sourceUri.fsPath);
	}

	private fireChange(sourceUri: vscode.Uri, comments: AsideComment[]): void {
		this._onDidChangeComments.fire({ uri: sourceUri, comments });
	}

	private scheduleSave(sourceUri: vscode.Uri, delayMs: number = 5000): void {
		const key = sourceUri.fsPath;
		const existing = this.saveTimers.get(key);
		if (existing) {
			clearTimeout(existing);
		}

		const timer = setTimeout(() => {
			this.saveTimers.delete(key);
			this.save(sourceUri).catch(err => {
				console.error('[Aside] Failed to auto-save comments:', err);
			});
		}, delayMs);

		this.saveTimers.set(key, timer);
	}

	dispose(): void {
		// Save all dirty before disposing
		for (const timer of this.saveTimers.values()) {
			clearTimeout(timer);
		}
		this.saveTimers.clear();
		this._onDidChangeComments.dispose();
	}
}
