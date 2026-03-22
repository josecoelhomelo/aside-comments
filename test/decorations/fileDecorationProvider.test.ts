import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsideFileDecorationProvider } from '../../src/decorations/FileDecorationProvider';
import { Uri, EventEmitter, FileDecoration, workspace } from '../__mocks__/vscode';
import type { AsideComment, CommentChangeEvent } from '../../src/types';

function makeComment(overrides: Partial<AsideComment> = {}): AsideComment {
	return {
		id: 'test-id',
		lineStart: 0,
		lineEnd: 0,
		text: 'test',
		author: 'tester',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		anchorContent: 'content',
		...overrides,
	};
}

function makeMockStore(comments: AsideComment[] = []) {
	const emitter = new EventEmitter<CommentChangeEvent>();
	return {
		getComments: vi.fn().mockResolvedValue(comments),
		onDidChangeComments: emitter.event,
		_emitter: emitter,
	};
}

describe('AsideFileDecorationProvider', () => {
	let store: ReturnType<typeof makeMockStore>;

	beforeEach(() => {
		vi.clearAllMocks();
		store = makeMockStore();
		// Default: showExplorerBadges = true
		workspace.getConfiguration.mockReturnValue({
			get: vi.fn((_key: string, defaultValue?: any) => defaultValue),
		});
	});

	describe('provideFileDecoration', () => {
		it('returns a badge decoration when file has comments', async () => {
			store = makeMockStore([makeComment()]);
			const provider = new AsideFileDecorationProvider(store as any);

			const uri = Uri.file('/test/file.ts');
			const result = await provider.provideFileDecoration(uri as any);

			expect(result).toBeDefined();
			expect(result!.badge).toBe('🗨');
		});

		it('returns undefined when file has no comments', async () => {
			const provider = new AsideFileDecorationProvider(store as any);

			const uri = Uri.file('/test/file.ts');
			const result = await provider.provideFileDecoration(uri as any);

			expect(result).toBeUndefined();
		});

		it('returns a badge decoration for a folder URI with comments', async () => {
			store = makeMockStore([makeComment({ lineStart: -1, lineEnd: -1 })]);
			const provider = new AsideFileDecorationProvider(store as any);

			const uri = Uri.file('/test/src/components');
			const result = await provider.provideFileDecoration(uri as any);

			expect(result).toBeDefined();
			expect(result!.badge).toBe('🗨');
		});

		it('returns undefined for non-file schemes', async () => {
			const provider = new AsideFileDecorationProvider(store as any);

			const uri = Uri.parse('untitled:Untitled-1');
			(uri as any).scheme = 'untitled';
			const result = await provider.provideFileDecoration(uri as any);

			expect(result).toBeUndefined();
			expect(store.getComments).not.toHaveBeenCalled();
		});

		it('returns undefined when showExplorerBadges is disabled', async () => {
			workspace.getConfiguration.mockReturnValue({
				get: vi.fn((_key: string, _defaultValue?: any) => false),
			});
			store = makeMockStore([makeComment()]);
			const provider = new AsideFileDecorationProvider(store as any);

			const uri = Uri.file('/test/file.ts');
			const result = await provider.provideFileDecoration(uri as any);

			expect(result).toBeUndefined();
			expect(store.getComments).not.toHaveBeenCalled();
		});
	});

	describe('onDidChangeFileDecorations', () => {
		it('fires when the store emits a comment change', () => {
			const provider = new AsideFileDecorationProvider(store as any);
			const listener = vi.fn();
			provider.onDidChangeFileDecorations(listener);

			const uri = Uri.file('/test/file.ts');
			store._emitter.fire({ uri: uri as any, comments: [] });

			expect(listener).toHaveBeenCalledWith(uri);
		});
	});

	describe('dispose', () => {
		it('cleans up without errors', () => {
			const provider = new AsideFileDecorationProvider(store as any);
			expect(() => provider.dispose()).not.toThrow();
		});
	});
});
