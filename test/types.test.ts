import { describe, it, expect } from 'vitest';
import { isFileComment, COMMENT_COLORS, DEFAULT_COMMENT_COLOR, ASIDE_FILE_VERSION, AsideComment } from '../src/types';

function makeComment(overrides: Partial<AsideComment> = {}): AsideComment {
	return {
		id: 'test-id',
		lineStart: 0,
		lineEnd: 0,
		text: 'test',
		author: 'tester',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		anchorContent: 'line content',
		...overrides,
	};
}

describe('isFileComment', () => {
	it('returns true when lineStart and lineEnd are both -1', () => {
		const comment = makeComment({ lineStart: -1, lineEnd: -1 });
		expect(isFileComment(comment)).toBe(true);
	});

	it('returns false for a line comment at line 0', () => {
		const comment = makeComment({ lineStart: 0, lineEnd: 0 });
		expect(isFileComment(comment)).toBe(false);
	});

	it('returns false for a multi-line comment', () => {
		const comment = makeComment({ lineStart: 5, lineEnd: 10 });
		expect(isFileComment(comment)).toBe(false);
	});

	it('returns false when only lineStart is -1', () => {
		const comment = makeComment({ lineStart: -1, lineEnd: 0 });
		expect(isFileComment(comment)).toBe(false);
	});

	it('returns false when only lineEnd is -1', () => {
		const comment = makeComment({ lineStart: 0, lineEnd: -1 });
		expect(isFileComment(comment)).toBe(false);
	});
});

describe('COMMENT_COLORS', () => {
	it('has 8 colors', () => {
		expect(COMMENT_COLORS).toHaveLength(8);
	});

	it('contains only hex color strings', () => {
		for (const color of COMMENT_COLORS) {
			expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
		}
	});
});

describe('DEFAULT_COMMENT_COLOR', () => {
	it('equals the first color in the palette', () => {
		expect(DEFAULT_COMMENT_COLOR).toBe(COMMENT_COLORS[0]);
	});
});

describe('ASIDE_FILE_VERSION', () => {
	it('is 1', () => {
		expect(ASIDE_FILE_VERSION).toBe(1);
	});
});
