import { vi } from 'vitest';
import nodePath from 'path';

export class Uri {
	readonly scheme: string;
	readonly fsPath: string;
	readonly path: string;

	private constructor(scheme: string, fsPath: string) {
		this.scheme = scheme;
		this.fsPath = fsPath;
		this.path = fsPath;
	}

	static file(fsPath: string): Uri {
		// Normalize path separators like the real VS Code Uri does
		return new Uri('file', nodePath.normalize(fsPath));
	}

	static parse(value: string): Uri {
		return new Uri('file', value);
	}

	toString(): string {
		return this.fsPath;
	}

	with(_change: { scheme?: string; path?: string }): Uri {
		return new Uri(_change.scheme ?? this.scheme, _change.path ?? this.fsPath);
	}
}

export class Position {
	constructor(readonly line: number, readonly character: number) {}
}

export class Range {
	readonly start: Position;
	readonly end: Position;

	constructor(startLine: number, startChar: number, endLine: number, endChar: number);
	constructor(start: Position, end: Position);
	constructor(
		startOrStartLine: number | Position,
		startCharOrEnd: number | Position,
		endLine?: number,
		endChar?: number
	) {
		if (typeof startOrStartLine === 'number') {
			this.start = new Position(startOrStartLine, startCharOrEnd as number);
			this.end = new Position(endLine!, endChar!);
		} else {
			this.start = startOrStartLine;
			this.end = startCharOrEnd as Position;
		}
	}
}

export class Selection extends Range {
	readonly anchor: Position;
	readonly active: Position;

	constructor(anchorLine: number, anchorChar: number, activeLine: number, activeChar: number) {
		super(anchorLine, anchorChar, activeLine, activeChar);
		this.anchor = this.start;
		this.active = this.end;
	}
}

export class EventEmitter<T> {
	private listeners: Array<(e: T) => void> = [];

	event = (listener: (e: T) => void): { dispose: () => void } => {
		this.listeners.push(listener);
		return {
			dispose: () => {
				const idx = this.listeners.indexOf(listener);
				if (idx >= 0) {
					this.listeners.splice(idx, 1);
				}
			},
		};
	};

	fire(data: T): void {
		for (const listener of this.listeners) {
			listener(data);
		}
	}

	dispose(): void {
		this.listeners = [];
	}
}

export class RelativePattern {
	constructor(readonly base: any, readonly pattern: string) {}
}

export class ThemeColor {
	constructor(readonly id: string) {}
}

export class FileDecoration {
	constructor(
		readonly badge?: string,
		readonly tooltip?: string,
		readonly color?: ThemeColor
	) {}
}

export enum OverviewRulerLane {
	Left = 1,
	Center = 2,
	Right = 4,
	Full = 7,
}

export enum FileType {
	Unknown = 0,
	File = 1,
	Directory = 2,
	SymbolicLink = 64,
}

export enum TextEditorRevealType {
	Default = 0,
	InCenter = 1,
	InCenterIfOutsideViewport = 2,
	AtTop = 3,
}

export const workspace = {
	getWorkspaceFolder: vi.fn(),
	workspaceFolders: [] as any[],
	asRelativePath: vi.fn(),
	getConfiguration: vi.fn(() => ({
		get: vi.fn((_key: string, defaultValue?: any) => defaultValue),
	})),
	openTextDocument: vi.fn(),
	findFiles: vi.fn(),
	fs: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		delete: vi.fn(),
		createDirectory: vi.fn(),
		stat: vi.fn(),
	},
	onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	onDidRenameFiles: vi.fn(() => ({ dispose: vi.fn() })),
	onDidDeleteFiles: vi.fn(() => ({ dispose: vi.fn() })),
	onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
	createFileSystemWatcher: vi.fn(() => ({
		onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
		onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
		dispose: vi.fn(),
	})),
};

export const window = {
	activeTextEditor: undefined as any,
	visibleTextEditors: [] as any[],
	showWarningMessage: vi.fn(),
	showInformationMessage: vi.fn(),
	showQuickPick: vi.fn(),
	showInputBox: vi.fn(),
	showTextDocument: vi.fn(),
	createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
	onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	onDidChangeVisibleTextEditors: vi.fn(() => ({ dispose: vi.fn() })),
	registerFileDecorationProvider: vi.fn(() => ({ dispose: vi.fn() })),
	registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

export const commands = {
	registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
	executeCommand: vi.fn(),
};

export const authentication = {
	getSession: vi.fn(),
};

export const languages = {
	registerCodeLensProvider: vi.fn(),
};
