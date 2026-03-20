import * as vscode from 'vscode';

export const COMMENT_COLORS = [
	'#FFA500', // orange (default)
	'#4FC3F7', // blue
	'#81C784', // green
	'#E57373', // red
	'#BA68C8', // purple
	'#FFD54F', // yellow
	'#4DB6AC', // teal
	'#FF8A65', // coral
] as const;

export const DEFAULT_COMMENT_COLOR = COMMENT_COLORS[0];

export interface AsideComment {
	id: string;
	lineStart: number; // 0-based line number
	lineEnd: number; // 0-based, inclusive
	text: string;
	author: string;
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
	anchorContent: string; // snapshot of anchored lines for fuzzy re-attach
	orphaned?: boolean; // true if the comment lost its anchor
	color?: string; // hex color for the comment indicator
}

export interface AsideFileData {
	version: number;
	fileHash: string;
	comments: AsideComment[];
}

export interface CommentChangeEvent {
	uri: vscode.Uri;
	comments: AsideComment[];
}

export const ASIDE_FILE_VERSION = 1;

/** Sentinel value indicating a file-level comment (not attached to specific lines). */
export function isFileComment(comment: AsideComment): boolean {
	return comment.lineStart === -1 && comment.lineEnd === -1;
}
