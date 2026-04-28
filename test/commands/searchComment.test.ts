import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import { registerSearchComment } from '../../src/commands/searchComment';
import { commands, FileType, Uri, window, workspace } from '../__mocks__/vscode';
import type { AsideComment } from '../../src/types';

function makeComment(overrides: Partial<AsideComment> = {}): AsideComment {
	return {
		id: 'test-id',
		lineStart: -1,
		lineEnd: -1,
		text: 'folder note',
		author: 'tester',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		anchorContent: '',
		...overrides,
	};
}

function makeWorkspaceFolder(fsPath: string) {
	return {
		uri: Uri.file(fsPath),
		name: path.basename(fsPath),
		index: 0,
	};
}

async function runRegisteredSearchCommand(): Promise<void> {
	const registration = commands.registerCommand.mock.calls.find(
		([command]) => command === 'asideComments.searchComment'
	);
	expect(registration).toBeDefined();

	await registration![1]();
}

describe('searchComment command', () => {
	const wsRoot = path.normalize('/workspace/project');
	const wsFolder = makeWorkspaceFolder(wsRoot);

	beforeEach(() => {
		vi.clearAllMocks();
		workspace.workspaceFolders = [wsFolder as any];
		workspace.asRelativePath.mockImplementation((uri: any) =>
			path.relative(wsRoot, uri.fsPath)
		);
		window.showInputBox.mockResolvedValue('note');
		window.showQuickPick.mockImplementation(async (items: any[]) => items[0]);
	});

	it('opens the comments panel for folder search results', async () => {
		const folderUri = Uri.file(path.join(wsRoot, 'src', 'components'));
		const asideUri = Uri.file(path.join(wsRoot, '.aside', 'src', 'components.json'));
		const store = {
			getComments: vi.fn().mockResolvedValue([makeComment()]),
		};
		const fileMapper = {
			getWatchPattern: vi.fn(),
			getSourcePath: vi.fn().mockReturnValue(folderUri),
		};
		const panelProvider = {
			setCurrentUri: vi.fn(),
			revealAndWaitForReady: vi.fn().mockResolvedValue(undefined),
		};

		workspace.findFiles.mockResolvedValue([asideUri]);
		workspace.fs.stat.mockResolvedValue({ type: FileType.Directory });

		registerSearchComment({ subscriptions: [] } as any, store as any, fileMapper as any, panelProvider as any);
		await runRegisteredSearchCommand();

		const quickPickItems = window.showQuickPick.mock.calls[0][0];
		expect(quickPickItems[0].description).toContain('folder comment');
		expect(panelProvider.setCurrentUri).toHaveBeenCalledWith(folderUri, true);
		expect(panelProvider.revealAndWaitForReady).toHaveBeenCalled();
		expect(workspace.openTextDocument).not.toHaveBeenCalled();
		expect(window.showTextDocument).not.toHaveBeenCalled();
	});

	it('still opens file search results in an editor', async () => {
		const fileUri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
		const asideUri = Uri.file(path.join(wsRoot, '.aside', 'src', 'app.ts.json'));
		const document = { lineCount: 1 };
		const editor = {
			selection: undefined,
			revealRange: vi.fn(),
		};
		const store = {
			getComments: vi.fn().mockResolvedValue([makeComment({ text: 'file note' })]),
		};
		const fileMapper = {
			getWatchPattern: vi.fn(),
			getSourcePath: vi.fn().mockReturnValue(fileUri),
		};
		const panelProvider = {
			setCurrentUri: vi.fn(),
			revealAndWaitForReady: vi.fn(),
		};

		workspace.findFiles.mockResolvedValue([asideUri]);
		workspace.fs.stat.mockResolvedValue({ type: FileType.File });
		workspace.openTextDocument.mockResolvedValue(document);
		window.showTextDocument.mockResolvedValue(editor);

		registerSearchComment({ subscriptions: [] } as any, store as any, fileMapper as any, panelProvider as any);
		await runRegisteredSearchCommand();

		expect(workspace.openTextDocument).toHaveBeenCalledWith(fileUri);
		expect(window.showTextDocument).toHaveBeenCalledWith(document);
		expect(panelProvider.setCurrentUri).not.toHaveBeenCalled();
	});
});
