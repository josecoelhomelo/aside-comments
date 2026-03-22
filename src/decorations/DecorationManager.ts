import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AsideComment, DEFAULT_COMMENT_COLOR } from '../types';
import { CommentStore } from '../store/CommentStore';

const GUTTER_LINE_DIR = path.join(os.tmpdir(), 'aside-gutter-lines');

export class DecorationManager {
	private colorTypes = new Map<string, vscode.TextEditorDecorationType>();
	private orphanedType: vscode.TextEditorDecorationType;
	private activeColors = new Set<string>(); // colors currently in use

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly store: CommentStore
	) {
		// Ensure gutter line directory exists
		fs.mkdirSync(GUTTER_LINE_DIR, { recursive: true });

		this.orphanedType = this.createType('#FF6B6B', true);

		// Listen for comment changes
		store.onDidChangeComments((event) => {
			this.refreshForUri(event.uri);
		});

		// Listen for active editor changes
		vscode.window.onDidChangeActiveTextEditor(
			(editor) => {
				if (editor) {
					this.refreshEditor(editor);
				}
			},
			null,
			context.subscriptions
		);

		// Recreate decoration types when settings change
		vscode.workspace.onDidChangeConfiguration(
			(e) => {
				if (
					e.affectsConfiguration('asideComments.showScrollbarIndicators') ||
					e.affectsConfiguration('asideComments.showGutterLines')
				) {
					this.recreateDecorationTypes();
				}
			},
			null,
			context.subscriptions
		);

		// Apply decorations to all visible editors on startup
		for (const editor of vscode.window.visibleTextEditors) {
			this.refreshEditor(editor);
		}
	}

	private recreateDecorationTypes(): void {
		// Dispose all existing types
		for (const type of this.colorTypes.values()) {
			type.dispose();
		}
		this.colorTypes.clear();
		this.orphanedType.dispose();

		// Recreate orphaned type
		this.orphanedType = this.createType('#FF6B6B', true);

		// Refresh all visible editors
		for (const editor of vscode.window.visibleTextEditors) {
			this.refreshEditor(editor);
		}
	}

	private getGutterSvgPath(color: string): string {
		const hash = color.replace('#', '');
		const filePath = path.join(GUTTER_LINE_DIR, `gutter-${hash}.svg`);
		if (!fs.existsSync(filePath)) {
			const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="20" viewBox="0 0 3 20"><rect x="0.5" width="2" height="20" rx="1" fill="${color}"/></svg>`;
			fs.writeFileSync(filePath, svg, 'utf-8');
		}
		return filePath;
	}

	private createType(color: string, orphaned: boolean = false): vscode.TextEditorDecorationType {
		const config = vscode.workspace.getConfiguration('asideComments');
		const showScrollbar = config.get<boolean>('showScrollbarIndicators', true);
		const showGutter = config.get<boolean>('showGutterLines', true);
		const bgAlpha = orphaned ? 0.10 : 0.08;

		return vscode.window.createTextEditorDecorationType({
			...(showGutter && {
				gutterIconPath: this.getGutterSvgPath(color),
				gutterIconSize: 'contain',
			}),
			isWholeLine: true,
			...(showScrollbar && {
				overviewRulerColor: color + 'AA',
				overviewRulerLane: vscode.OverviewRulerLane.Right,
			}),
			light: {
				backgroundColor: this.hexToRgba(color, orphaned ? 0.07 : 0.05),
			},
			dark: {
				backgroundColor: this.hexToRgba(color, bgAlpha),
			},
		});
	}

	private getColorType(color: string): vscode.TextEditorDecorationType {
		if (!this.colorTypes.has(color)) {
			this.colorTypes.set(color, this.createType(color));
		}
		return this.colorTypes.get(color)!;
	}

	async refreshForUri(uri: vscode.Uri): Promise<void> {
		for (const editor of vscode.window.visibleTextEditors) {
			if (editor.document.uri.fsPath === uri.fsPath) {
				await this.refreshEditor(editor);
			}
		}
	}

	async refreshEditor(editor: vscode.TextEditor): Promise<void> {
		const comments = await this.store.getComments(editor.document.uri);

		// Group comments by color (orphaned get their own group)
		const colorGroups = new Map<string, vscode.DecorationOptions[]>();
		const orphanedRanges: vscode.DecorationOptions[] = [];

		for (const comment of comments) {
			// Skip file-level comments — they don't decorate specific lines
			if (comment.lineStart === -1 && comment.lineEnd === -1) {
				continue;
			}

			const startLine = Math.max(0, comment.lineStart);
			const endLine = Math.min(editor.document.lineCount - 1, comment.lineEnd);
			const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
			const hoverMessage = this.buildHoverMessage(editor.document, comment);

			const decoration: vscode.DecorationOptions = { range, hoverMessage };

			if (comment.orphaned) {
				orphanedRanges.push(decoration);
			} else {
				const color = comment.color || DEFAULT_COMMENT_COLOR;
				if (!colorGroups.has(color)) {
					colorGroups.set(color, []);
				}
				colorGroups.get(color)!.push(decoration);
			}
		}

		// Clear previous colors that are no longer used
		const newColors = new Set(colorGroups.keys());
		for (const oldColor of this.activeColors) {
			if (!newColors.has(oldColor)) {
				const type = this.colorTypes.get(oldColor);
				if (type) {
					editor.setDecorations(type, []);
				}
			}
		}
		this.activeColors = newColors;

		// Apply per-color decorations
		for (const [color, decorations] of colorGroups) {
			const type = this.getColorType(color);
			editor.setDecorations(type, decorations);
		}

		// Apply orphaned decorations
		editor.setDecorations(this.orphanedType, orphanedRanges);
	}

	private buildHoverMessage(document: vscode.TextDocument, c: AsideComment): vscode.MarkdownString {
		const md = new vscode.MarkdownString('', true);
		md.isTrusted = true;
		md.supportHtml = true;

		const date = new Date(c.updatedAt).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});

		const lineRange =
			c.lineStart === c.lineEnd
				? `Line ${c.lineStart + 1}`
				: `Lines ${c.lineStart + 1}-${c.lineEnd + 1}`;

		if (c.orphaned) {
			md.appendMarkdown(`⚠️ **Orphaned Comment**\n\n`);
		}

		md.appendMarkdown(`**${c.author}** — _${date}_ · ${lineRange}\n\n`);
		md.appendMarkdown(`${c.text}\n\n`);

		const editArgs = encodeURIComponent(JSON.stringify([document.uri.toString(), c.id]));
		const deleteArgs = encodeURIComponent(JSON.stringify([document.uri.toString(), c.id]));
		md.appendMarkdown(
			`[Edit](command:asideComments.editComment?${editArgs}) · [Delete](command:asideComments.deleteComment?${deleteArgs})\n\n`
		);

		return md;
	}

	private hexToRgba(hex: string, alpha: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	dispose(): void {
		for (const type of this.colorTypes.values()) {
			type.dispose();
		}
		this.colorTypes.clear();
		this.orphanedType.dispose();
	}
}
