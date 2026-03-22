import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommentStore } from '../../src/store/CommentStore';
import { FileMapper } from '../../src/store/FileMapper';
import { Uri, workspace, authentication } from '../__mocks__/vscode';
import { ASIDE_FILE_VERSION, DEFAULT_COMMENT_COLOR } from '../../src/types';
import path from 'path';

// Mock child_process for git author detection
vi.mock('child_process', () => ({
	execSync: vi.fn(),
}));

function makeWorkspaceFolder(fsPath: string) {
	return {
		uri: Uri.file(fsPath),
		name: path.basename(fsPath),
		index: 0,
	};
}

const wsRoot = '/workspace/project';
const wsFolder = makeWorkspaceFolder(wsRoot);

describe('CommentStore', () => {
	let store: CommentStore;
	let fileMapper: FileMapper;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		fileMapper = new FileMapper('.aside');

		// Set up workspace mocks
		workspace.getWorkspaceFolder.mockReturnValue(wsFolder);
		workspace.asRelativePath.mockImplementation((uri: any) => {
			const uriPath = typeof uri === 'string' ? uri : uri.fsPath;
			return path.relative(wsRoot, uriPath);
		});
		workspace.workspaceFolders = [wsFolder];
		workspace.fs.readFile.mockRejectedValue(new Error('File not found'));
		workspace.fs.writeFile.mockResolvedValue(undefined);
		workspace.fs.delete.mockResolvedValue(undefined);
		workspace.fs.createDirectory.mockResolvedValue(undefined);
		workspace.getConfiguration.mockReturnValue({
			get: vi.fn((_key: string, defaultValue?: any) => defaultValue),
		});
		authentication.getSession.mockRejectedValue(new Error('No session'));

		store = new CommentStore(fileMapper);
	});

	afterEach(() => {
		store.dispose();
		vi.useRealTimers();
	});

	describe('getComments', () => {
		it('returns empty array when no aside file exists', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comments = await store.getComments(uri as any);
			expect(comments).toEqual([]);
		});

		it('loads comments from disk on first call', async () => {
			const fileData = {
				version: ASIDE_FILE_VERSION,
				fileHash: 'abc123',
				comments: [{
					id: 'c1',
					lineStart: 0,
					lineEnd: 0,
					text: 'hello',
					author: 'tester',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
					anchorContent: 'line',
				}],
			};
			workspace.fs.readFile.mockResolvedValue(
				Buffer.from(JSON.stringify(fileData), 'utf-8')
			);

			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comments = await store.getComments(uri as any);

			expect(comments).toHaveLength(1);
			expect(comments[0].text).toBe('hello');
		});

		it('returns cached comments on second call (no disk read)', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.getComments(uri as any); // first call loads from disk
			workspace.fs.readFile.mockClear();

			const comments = await store.getComments(uri as any); // second call
			expect(workspace.fs.readFile).not.toHaveBeenCalled();
			expect(comments).toEqual([]);
		});
	});

	describe('addComment', () => {
		it('creates a comment with correct fields', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(
				uri as any, 5, 7, 'my comment', 'anchor text'
			);

			expect(comment.id).toBeDefined();
			expect(comment.lineStart).toBe(5);
			expect(comment.lineEnd).toBe(7);
			expect(comment.text).toBe('my comment');
			expect(comment.anchorContent).toBe('anchor text');
			expect(comment.createdAt).toBeDefined();
			expect(comment.updatedAt).toBe(comment.createdAt);
			expect(comment.color).toBe(DEFAULT_COMMENT_COLOR);
		});

		it('uses the provided color', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(
				uri as any, 0, 0, 'text', 'anchor', '#FF0000'
			);

			expect(comment.color).toBe('#FF0000');
		});

		it('sorts comments by lineStart after adding', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.addComment(uri as any, 10, 10, 'second', 'anchor');
			await store.addComment(uri as any, 2, 2, 'first', 'anchor');

			const comments = await store.getComments(uri as any);
			expect(comments[0].lineStart).toBe(2);
			expect(comments[1].lineStart).toBe(10);
		});

		it('fires onDidChangeComments event', async () => {
			const listener = vi.fn();
			store.onDidChangeComments(listener);

			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					uri: uri,
					comments: expect.any(Array),
				})
			);
		});

		it('schedules a debounced save', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			workspace.openTextDocument.mockResolvedValue({
				lineCount: 1,
				lineAt: () => ({ text: 'anchor' }),
				getText: () => 'anchor',
			});

			await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			// Save not yet called
			expect(workspace.fs.writeFile).not.toHaveBeenCalled();

			// Advance past debounce
			await vi.advanceTimersByTimeAsync(5000);

			expect(workspace.fs.writeFile).toHaveBeenCalled();
		});
	});

	describe('updateComment', () => {
		it('updates text and updatedAt', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(uri as any, 0, 0, 'old', 'anchor');
			const originalUpdatedAt = comment.updatedAt;

			// Advance time so updatedAt differs
			vi.advanceTimersByTime(1000);
			const result = await store.updateComment(uri as any, comment.id, 'new text');

			expect(result).toBe(true);
			expect(comment.text).toBe('new text');
			expect(comment.updatedAt).not.toBe(originalUpdatedAt);
		});

		it('updates color when provided', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			await store.updateComment(uri as any, comment.id, 'text', '#00FF00');
			expect(comment.color).toBe('#00FF00');
		});

		it('returns false for nonexistent comment ID', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.getComments(uri as any); // populate cache

			const result = await store.updateComment(uri as any, 'nonexistent', 'text');
			expect(result).toBe(false);
		});
	});

	describe('deleteComment', () => {
		it('removes the comment and returns true', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			const result = await store.deleteComment(uri as any, comment.id);
			expect(result).toBe(true);

			const comments = await store.getComments(uri as any);
			expect(comments).toHaveLength(0);
		});

		it('returns false for nonexistent comment ID', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.getComments(uri as any);

			const result = await store.deleteComment(uri as any, 'nonexistent');
			expect(result).toBe(false);
		});

		it('fires onDidChangeComments event', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			const listener = vi.fn();
			store.onDidChangeComments(listener);

			await store.deleteComment(uri as any, comment.id);
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe('updateCommentLines', () => {
		it('updates cache and fires change event', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.getComments(uri as any); // populate cache

			const listener = vi.fn();
			store.onDidChangeComments(listener);

			const newComments = [{
				id: 'c1', lineStart: 10, lineEnd: 12, text: 'moved',
				author: 'tester', createdAt: '', updatedAt: '', anchorContent: '',
			}];
			store.updateCommentLines(uri as any, newComments);

			expect(listener).toHaveBeenCalledTimes(1);
			const cached = await store.getComments(uri as any);
			expect(cached[0].lineStart).toBe(10);
		});
	});

	describe('save', () => {
		it('writes JSON to the correct aside path', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			workspace.openTextDocument.mockResolvedValue({
				lineCount: 1,
				lineAt: () => ({ text: 'line content' }),
				getText: () => 'line content',
			});

			await store.addComment(uri as any, 0, 0, 'text', 'anchor');
			await store.save(uri as any);

			expect(workspace.fs.writeFile).toHaveBeenCalled();
			const [writeUri, content] = workspace.fs.writeFile.mock.calls[0];
			expect(writeUri.fsPath).toContain('.aside');
			expect(writeUri.fsPath).toContain('app.ts.json');

			const parsed = JSON.parse(Buffer.from(content).toString('utf-8'));
			expect(parsed.version).toBe(ASIDE_FILE_VERSION);
			expect(parsed.comments).toHaveLength(1);
		});

		it('deletes aside file when no comments remain', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(uri as any, 0, 0, 'text', 'anchor');
			await store.deleteComment(uri as any, comment.id);
			await store.save(uri as any);

			expect(workspace.fs.delete).toHaveBeenCalled();
		});
	});

	describe('folder comments', () => {
		it('adds a folder comment with lineStart/lineEnd -1', async () => {
			const folderUri = Uri.file(path.join(wsRoot, 'src', 'components'));
			const comment = await store.addComment(
				folderUri as any, -1, -1, 'folder note', ''
			);

			expect(comment.lineStart).toBe(-1);
			expect(comment.lineEnd).toBe(-1);
			expect(comment.anchorContent).toBe('');

			const comments = await store.getComments(folderUri as any);
			expect(comments).toHaveLength(1);
		});

		it('save skips openTextDocument for folder-only comments', async () => {
			const folderUri = Uri.file(path.join(wsRoot, 'src', 'components'));
			await store.addComment(folderUri as any, -1, -1, 'folder note', '');
			await store.save(folderUri as any);

			// Should NOT try to open a text document for a folder
			expect(workspace.openTextDocument).not.toHaveBeenCalled();

			// Should still write the file
			expect(workspace.fs.writeFile).toHaveBeenCalled();
			const [, content] = workspace.fs.writeFile.mock.calls[0];
			const parsed = JSON.parse(Buffer.from(content).toString('utf-8'));
			expect(parsed.fileHash).toBe('');
			expect(parsed.comments).toHaveLength(1);
			expect(parsed.comments[0].lineStart).toBe(-1);
		});

		it('save opens document when mix of folder and line comments exist', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			workspace.openTextDocument.mockResolvedValue({
				lineCount: 5,
				lineAt: (i: number) => ({ text: `line${i}` }),
				getText: () => 'line0\nline1\nline2\nline3\nline4',
			});

			await store.addComment(uri as any, -1, -1, 'file note', '');
			await store.addComment(uri as any, 2, 3, 'line note', 'old anchor');
			await store.save(uri as any);

			// isFolderLike is false because there's a line comment, so it opens the document
			expect(workspace.openTextDocument).toHaveBeenCalled();
		});
	});

	describe('invalidateCache', () => {
		it('clears cache and pending timers', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			store.invalidateCache(uri as any);

			// Next getComments should reload from disk
			workspace.fs.readFile.mockClear();
			await store.getComments(uri as any);
			expect(workspace.fs.readFile).toHaveBeenCalled();
		});
	});

	describe('reloadFromDisk', () => {
		it('replaces cache from disk and fires event', async () => {
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			await store.addComment(uri as any, 0, 0, 'old', 'anchor');

			const newData = {
				version: ASIDE_FILE_VERSION,
				fileHash: 'new',
				comments: [{
					id: 'new-c1', lineStart: 3, lineEnd: 3, text: 'from disk',
					author: 'other', createdAt: '', updatedAt: '', anchorContent: '',
				}],
			};
			workspace.fs.readFile.mockResolvedValue(
				Buffer.from(JSON.stringify(newData), 'utf-8')
			);

			const listener = vi.fn();
			store.onDidChangeComments(listener);

			await store.reloadFromDisk(uri as any);

			const comments = await store.getComments(uri as any);
			expect(comments).toHaveLength(1);
			expect(comments[0].text).toBe('from disk');
			expect(listener).toHaveBeenCalled();
		});
	});

	describe('getAuthor (via addComment)', () => {
		it('uses configured author when set', async () => {
			workspace.getConfiguration.mockReturnValue({
				get: vi.fn((_key: string) => 'Configured Author'),
			});

			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			expect(comment.author).toBe('Configured Author');
		});

		it('falls back through the author detection chain when no config is set', async () => {
			// With no configured author and no auth sessions, the store
			// falls back to git config or OS username.
			// We just verify it returns a non-empty string.
			const uri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const comment = await store.addComment(uri as any, 0, 0, 'text', 'anchor');

			expect(comment.author).toBeTruthy();
			expect(typeof comment.author).toBe('string');
		});
	});

	describe('dispose', () => {
		it('clears all timers without errors', () => {
			expect(() => store.dispose()).not.toThrow();
		});
	});
});
