import * as vscode from 'vscode';
import { AsideComment } from '../types';
import { CommentStore } from './CommentStore';

export class LineTracker {
	constructor(private readonly store: CommentStore) {}

	/**
	 * Adjust comment line positions based on a text document change event.
	 */
	async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
		const comments = await this.store.getComments(event.document.uri);
		if (comments.length === 0) {
			return;
		}

		let changed = false;

		// Process changes in reverse order to avoid cascading adjustments
		const sortedChanges = [...event.contentChanges].sort(
			(a, b) => b.range.start.line - a.range.start.line
		);

		for (const change of sortedChanges) {
			if (this.adjustCommentLines(comments, change)) {
				changed = true;
			}
		}

		if (changed) {
			this.store.updateCommentLines(event.document.uri, comments);
		}
	}

	/**
	 * Attempt to re-attach orphaned comments by fuzzy matching their anchor content
	 * against the current document content.
	 */
	async fuzzyReattach(
		document: vscode.TextDocument,
		comments: AsideComment[],
		threshold: number = 0.7
	): Promise<boolean> {
		let changed = false;

		for (const comment of comments) {
			if (!comment.orphaned && !comment.anchorContent) {
				continue;
			}

			const anchorLines = comment.anchorContent.split('\n');
			if (anchorLines.length === 0) {
				continue;
			}

			let bestScore = 0;
			let bestStart = -1;

			// Slide a window of the same size as the anchor content across the document
			const windowSize = anchorLines.length;
			for (let start = 0; start <= document.lineCount - windowSize; start++) {
				const windowLines: string[] = [];
				for (let i = 0; i < windowSize; i++) {
					windowLines.push(document.lineAt(start + i).text);
				}
				const score = this.similarity(anchorLines, windowLines);
				if (score > bestScore) {
					bestScore = score;
					bestStart = start;
				}
			}

			if (bestScore >= threshold && bestStart >= 0) {
				comment.lineStart = bestStart;
				comment.lineEnd = bestStart + windowSize - 1;
				comment.orphaned = false;
				changed = true;
			} else if (!comment.orphaned) {
				comment.orphaned = true;
				changed = true;
			}
		}

		return changed;
	}

	private adjustCommentLines(
		comments: AsideComment[],
		change: vscode.TextDocumentContentChangeEvent
	): boolean {
		const changeStartLine = change.range.start.line;
		const changeEndLine = change.range.end.line;
		const oldLineCount = changeEndLine - changeStartLine + 1;
		const newLineCount = change.text.split('\n').length;
		const lineDelta = newLineCount - oldLineCount;

		if (lineDelta === 0 && changeStartLine === changeEndLine) {
			// Single-line edit within one line — no line shifting needed
			return false;
		}

		let changed = false;

		for (const comment of comments) {
			if (comment.lineStart === -1 && comment.lineEnd === -1) {
				continue;
			}

			if (comment.lineEnd < changeStartLine) {
				// Comment is entirely before the change — no adjustment
				continue;
			}

			if (comment.lineStart > changeEndLine) {
				// Comment is entirely after the change — shift by delta
				comment.lineStart += lineDelta;
				comment.lineEnd += lineDelta;
				changed = true;
				continue;
			}

			// Comment's range fully contains the change
			if (comment.lineStart <= changeStartLine && comment.lineEnd >= changeEndLine) {
				comment.lineEnd += lineDelta;
				changed = true;
				continue;
			}

			// Change fully contains the comment's range — the commented code was replaced
			if (changeStartLine <= comment.lineStart && changeEndLine >= comment.lineEnd) {
				comment.lineStart = changeStartLine;
				comment.lineEnd = changeStartLine + Math.max(0, newLineCount - 1);
				comment.orphaned = true;
				changed = true;
				continue;
			}

			// Partial overlap — best effort: clamp
			if (changeStartLine <= comment.lineStart) {
				// Change overlaps the beginning of the comment
				comment.lineStart = changeStartLine + Math.max(0, newLineCount - (changeEndLine - comment.lineStart + 1));
				comment.lineEnd += lineDelta;
			} else {
				// Change overlaps the end of the comment
				comment.lineEnd = Math.max(comment.lineStart, changeStartLine + Math.max(0, newLineCount - 1));
			}
			changed = true;
		}

		return changed;
	}

	/**
	 * Compute similarity between two arrays of lines (0 to 1).
	 * Uses a simple line-by-line comparison with trimmed matching.
	 */
	private similarity(linesA: string[], linesB: string[]): number {
		if (linesA.length === 0 || linesB.length === 0) {
			return 0;
		}

		let matches = 0;
		const total = Math.max(linesA.length, linesB.length);

		for (let i = 0; i < Math.min(linesA.length, linesB.length); i++) {
			const a = linesA[i].trim();
			const b = linesB[i].trim();

			if (a === b) {
				matches += 1;
			} else if (a.length > 0 && b.length > 0) {
				// Partial credit for similar lines
				const lcs = this.longestCommonSubsequenceLength(a, b);
				matches += (2 * lcs) / (a.length + b.length);
			}
		}

		return matches / total;
	}

	private longestCommonSubsequenceLength(a: string, b: string): number {
		// Optimized LCS for short strings using two-row approach
		const m = a.length;
		const n = b.length;
		let prev = new Array(n + 1).fill(0);
		let curr = new Array(n + 1).fill(0);

		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (a[i - 1] === b[j - 1]) {
					curr[j] = prev[j - 1] + 1;
				} else {
					curr[j] = Math.max(prev[j], curr[j - 1]);
				}
			}
			[prev, curr] = [curr, prev];
			curr.fill(0);
		}

		return prev[n];
	}
}
