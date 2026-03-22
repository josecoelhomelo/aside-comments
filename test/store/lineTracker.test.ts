import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LineTracker } from '../../src/store/LineTracker';
import { AsideComment } from '../../src/types';
import { Range, Uri } from '../__mocks__/vscode';

// Helper to create a minimal comment
function makeComment(overrides: Partial<AsideComment> = {}): AsideComment {
	return {
		id: 'c1',
		lineStart: 5,
		lineEnd: 7,
		text: 'test',
		author: 'tester',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		anchorContent: 'line5\nline6\nline7',
		...overrides,
	};
}

// Helper to create a mock TextDocumentContentChangeEvent-like change object
function makeChange(startLine: number, endLine: number, newText: string) {
	return {
		range: new Range(startLine, 0, endLine, 0),
		rangeOffset: 0,
		rangeLength: 0,
		text: newText,
	};
}

// Helper to create a mock TextDocumentChangeEvent
function makeChangeEvent(uri: any, changes: ReturnType<typeof makeChange>[]): any {
	return {
		document: { uri },
		contentChanges: changes,
		reason: undefined,
	};
}

// Helper to create a mock TextDocument for fuzzyReattach
function makeDocument(lines: string[]): any {
	return {
		lineCount: lines.length,
		lineAt: (i: number) => ({ text: lines[i] }),
	};
}

// Create a mock CommentStore
function makeMockStore(comments: AsideComment[] = []) {
	return {
		getComments: vi.fn().mockResolvedValue(comments),
		updateCommentLines: vi.fn(),
	} as any;
}

describe('LineTracker', () => {
	describe('handleDocumentChange — adjustCommentLines', () => {
		const uri = Uri.file('/test/file.ts');

		it('does nothing when there are no comments', async () => {
			const store = makeMockStore([]);
			const tracker = new LineTracker(store);

			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(0, 0, 'new line\n')])
			);

			expect(store.updateCommentLines).not.toHaveBeenCalled();
		});

		it('does not adjust a comment entirely before the change', async () => {
			const comment = makeComment({ lineStart: 1, lineEnd: 2 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Insert a new line at line 5 (after the comment)
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(5, 5, 'inserted\n')])
			);

			// Comment at lines 1-2 should not change (it's before the change at line 5)
			// But lineDelta is 1 (newLineCount=2, oldLineCount=1) and changeStartLine=5
			// Since comment.lineEnd (2) < changeStartLine (5), no adjustment
			expect(store.updateCommentLines).not.toHaveBeenCalled();
		});

		it('shifts a comment down when lines are inserted before it', async () => {
			const comment = makeComment({ lineStart: 5, lineEnd: 7 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Insert 2 new lines at line 2 (before the comment)
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(2, 2, 'a\nb\nc')])
			);

			// newLineCount=3, oldLineCount=1, delta=+2
			expect(comment.lineStart).toBe(7);
			expect(comment.lineEnd).toBe(9);
			expect(store.updateCommentLines).toHaveBeenCalledWith(uri, [comment]);
		});

		it('shifts a comment up when lines are deleted before it', async () => {
			const comment = makeComment({ lineStart: 5, lineEnd: 7 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Delete lines 1-3 (replace 3 lines with nothing)
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(1, 3, '')])
			);

			// oldLineCount=3, newLineCount=1 (empty string = 1 line), delta=-2
			expect(comment.lineStart).toBe(3);
			expect(comment.lineEnd).toBe(5);
			expect(store.updateCommentLines).toHaveBeenCalled();
		});

		it('expands a comment when lines are inserted inside it', async () => {
			const comment = makeComment({ lineStart: 5, lineEnd: 7 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Insert a line inside the comment (at line 6)
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(6, 6, 'new\nline')])
			);

			// Comment contains the change (5 <= 6 and 7 >= 6)
			// delta = +1 applied to lineEnd
			expect(comment.lineStart).toBe(5);
			expect(comment.lineEnd).toBe(8);
			expect(store.updateCommentLines).toHaveBeenCalled();
		});

		it('marks a comment as orphaned when the change fully contains it', async () => {
			const comment = makeComment({ lineStart: 5, lineEnd: 7 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Replace lines 3-10 with a single line
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(3, 10, 'replacement')])
			);

			expect(comment.orphaned).toBe(true);
			expect(comment.lineStart).toBe(3);
			expect(comment.lineEnd).toBe(3);
			expect(store.updateCommentLines).toHaveBeenCalled();
		});

		it('skips file-level comments (lineStart === -1)', async () => {
			const comment = makeComment({ lineStart: -1, lineEnd: -1 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(0, 5, 'new\ncontent')])
			);

			expect(comment.lineStart).toBe(-1);
			expect(comment.lineEnd).toBe(-1);
			// No changes were made since only file-level comments exist
			expect(store.updateCommentLines).not.toHaveBeenCalled();
		});

		it('returns false for a single-line edit on the same line (no line shift)', async () => {
			const comment = makeComment({ lineStart: 5, lineEnd: 7 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Edit within line 3 (no line count change), entirely before the comment
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(3, 3, 'edited text')])
			);

			// Single-line edit: lineDelta=0, changeStartLine===changeEndLine → returns false
			expect(comment.lineStart).toBe(5);
			expect(comment.lineEnd).toBe(7);
			expect(store.updateCommentLines).not.toHaveBeenCalled();
		});

		it('handles partial overlap: change overlaps the beginning of the comment', async () => {
			const comment = makeComment({ lineStart: 5, lineEnd: 10 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Change spans lines 3-6 (overlaps start of comment at 5)
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(3, 6, 'a\nb')])
			);

			// changeStartLine=3, changeEndLine=6, oldLineCount=4, newLineCount=2, delta=-2
			// Partial overlap: changeStartLine(3) <= comment.lineStart(5)
			// comment.lineStart = 3 + max(0, 2 - (6-5+1)) = 3 + max(0, 0) = 3
			// comment.lineEnd = 10 + (-2) = 8
			expect(comment.lineStart).toBe(3);
			expect(comment.lineEnd).toBe(8);
			expect(store.updateCommentLines).toHaveBeenCalled();
		});

		it('handles partial overlap: change overlaps the end of the comment', async () => {
			const comment = makeComment({ lineStart: 5, lineEnd: 10 });
			const store = makeMockStore([comment]);
			const tracker = new LineTracker(store);

			// Change spans lines 8-12 (overlaps end of comment at 10)
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [makeChange(8, 12, 'x\ny')])
			);

			// changeStartLine=8, not <= comment.lineStart(5), so else branch
			// comment.lineEnd = max(5, 8 + max(0, 2-1)) = max(5, 9) = 9
			expect(comment.lineStart).toBe(5);
			expect(comment.lineEnd).toBe(9);
			expect(store.updateCommentLines).toHaveBeenCalled();
		});

		it('processes multiple changes in reverse line order', async () => {
			const comment1 = makeComment({ id: 'c1', lineStart: 2, lineEnd: 3 });
			const comment2 = makeComment({ id: 'c2', lineStart: 10, lineEnd: 12 });
			const store = makeMockStore([comment1, comment2]);
			const tracker = new LineTracker(store);

			// Two insertions: one at line 0, one at line 8
			await tracker.handleDocumentChange(
				makeChangeEvent(uri, [
					makeChange(0, 0, 'a\nb'),   // +1 line at start
					makeChange(8, 8, 'x\ny\nz'), // +2 lines in middle
				])
			);

			// Processed in reverse order (line 8 first, then line 0)
			// After line 8 insert (+2): comment2 (10-12) shifts to 12-14
			// After line 0 insert (+1): comment1 (2-3) shifts to 3-4, comment2 (12-14) shifts to 13-15
			expect(comment1.lineStart).toBe(3);
			expect(comment1.lineEnd).toBe(4);
			expect(comment2.lineStart).toBe(13);
			expect(comment2.lineEnd).toBe(15);
			expect(store.updateCommentLines).toHaveBeenCalled();
		});
	});

	describe('fuzzyReattach', () => {
		it('reattaches an orphaned comment with exact match', async () => {
			const comment = makeComment({
				lineStart: 0,
				lineEnd: 0,
				orphaned: true,
				anchorContent: 'function foo() {',
			});
			const store = makeMockStore();
			const tracker = new LineTracker(store);

			const doc = makeDocument([
				'import bar;',
				'',
				'function foo() {',
				'  return 1;',
				'}',
			]);

			const changed = await tracker.fuzzyReattach(doc, [comment], 0.7);

			expect(changed).toBe(true);
			expect(comment.orphaned).toBe(false);
			expect(comment.lineStart).toBe(2);
			expect(comment.lineEnd).toBe(2);
		});

		it('reattaches with a similar (above threshold) match', async () => {
			const comment = makeComment({
				lineStart: 0,
				lineEnd: 0,
				orphaned: true,
				anchorContent: 'function foo() {',
			});
			const store = makeMockStore();
			const tracker = new LineTracker(store);

			const doc = makeDocument([
				'import bar;',
				'',
				'function foo(x) {', // slightly different
				'  return 1;',
			]);

			const changed = await tracker.fuzzyReattach(doc, [comment], 0.5);

			expect(changed).toBe(true);
			expect(comment.orphaned).toBe(false);
			expect(comment.lineStart).toBe(2);
		});

		it('stays orphaned when no match meets the threshold', async () => {
			const comment = makeComment({
				lineStart: 0,
				lineEnd: 0,
				orphaned: true,
				anchorContent: 'function foo() {',
			});
			const store = makeMockStore();
			const tracker = new LineTracker(store);

			const doc = makeDocument([
				'completely different content',
				'nothing matches',
			]);

			const changed = await tracker.fuzzyReattach(doc, [comment], 0.7);

			// The comment was already orphaned, and didn't change state
			// Actually: it goes through the loop, bestScore < threshold, and
			// !comment.orphaned is false (it IS orphaned), so no change
			expect(changed).toBe(false);
			expect(comment.orphaned).toBe(true);
		});

		it('marks a non-orphaned comment as orphaned when anchor not found', async () => {
			const comment = makeComment({
				lineStart: 5,
				lineEnd: 5,
				orphaned: false,
				anchorContent: 'unique line that does not exist',
			});
			const store = makeMockStore();
			const tracker = new LineTracker(store);

			const doc = makeDocument([
				'completely different content',
				'nothing matches at all',
			]);

			const changed = await tracker.fuzzyReattach(doc, [comment], 0.9);

			expect(changed).toBe(true);
			expect(comment.orphaned).toBe(true);
		});

		it('does not change a non-orphaned comment with empty anchorContent when doc has one line', async () => {
			// anchorContent '' splits to [''], length 1 — so the window slides once
			// similarity of [''] vs ['some content'] gives partial credit:
			// both trimmed: '' vs 'some content' — a is empty, so 0 credit
			// score = 0/1 = 0, below threshold
			// !comment.orphaned is true → sets orphaned = true, changed = true
			// BUT: the condition is `!comment.orphaned && !comment.anchorContent`
			// anchorContent is '' (falsy), orphaned is false → both true → skips
			const comment = makeComment({
				orphaned: false,
				anchorContent: '',
			});
			const store = makeMockStore();
			const tracker = new LineTracker(store);

			const doc = makeDocument(['some content']);
			const changed = await tracker.fuzzyReattach(doc, [comment], 0.7);

			// The condition `!comment.orphaned && !comment.anchorContent` is true
			// so the comment is skipped entirely
			expect(changed).toBe(false);
			expect(comment.orphaned).toBeFalsy();
		});

		it('reattaches a multi-line anchor at the best position', async () => {
			const comment = makeComment({
				lineStart: 0,
				lineEnd: 1,
				orphaned: true,
				anchorContent: 'function bar() {\n  return 42;',
			});
			const store = makeMockStore();
			const tracker = new LineTracker(store);

			const doc = makeDocument([
				'import x;',
				'function foo() {',
				'  return 1;',
				'}',
				'function bar() {',
				'  return 42;',
				'}',
			]);

			const changed = await tracker.fuzzyReattach(doc, [comment], 0.7);

			expect(changed).toBe(true);
			expect(comment.lineStart).toBe(4);
			expect(comment.lineEnd).toBe(5);
			expect(comment.orphaned).toBe(false);
		});

		it('threshold 1.0 requires exact match', async () => {
			const comment = makeComment({
				lineStart: 0,
				lineEnd: 0,
				orphaned: true,
				anchorContent: 'function foo() {',
			});
			const store = makeMockStore();
			const tracker = new LineTracker(store);

			const doc = makeDocument([
				'function foo(x) {', // close but not exact
			]);

			const changed = await tracker.fuzzyReattach(doc, [comment], 1.0);

			expect(comment.orphaned).toBe(true);
		});
	});
});
