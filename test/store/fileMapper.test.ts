import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileMapper } from '../../src/store/FileMapper';
import { Uri, workspace, RelativePattern } from '../__mocks__/vscode';
import path from 'path';

function makeWorkspaceFolder(fsPath: string) {
	return {
		uri: Uri.file(fsPath),
		name: path.basename(fsPath),
		index: 0,
	};
}

describe('FileMapper', () => {
	let mapper: FileMapper;
	const wsRoot = '/workspace/project';
	const wsFolder = makeWorkspaceFolder(wsRoot);

	beforeEach(() => {
		vi.clearAllMocks();
		mapper = new FileMapper('.aside');
		workspace.getWorkspaceFolder.mockReturnValue(wsFolder);
		workspace.asRelativePath.mockImplementation((uri: any, _includeRoot?: boolean) => {
			const uriPath = typeof uri === 'string' ? uri : uri.fsPath;
			return path.relative(wsRoot, uriPath);
		});
		workspace.workspaceFolders = [wsFolder];
	});

	describe('getAsidePath', () => {
		it('maps a source file to its .aside JSON path', () => {
			const sourceUri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const result = mapper.getAsidePath(sourceUri);

			expect(result).toBeDefined();
			const expected = path.join(wsRoot, '.aside', 'src', 'app.ts.json');
			expect(result!.fsPath).toBe(expected);
		});

		it('returns undefined when file is outside any workspace', () => {
			workspace.getWorkspaceFolder.mockReturnValue(undefined);
			const sourceUri = Uri.file('/other/file.ts');
			const result = mapper.getAsidePath(sourceUri);

			expect(result).toBeUndefined();
		});

		it('handles deeply nested directories', () => {
			const sourceUri = Uri.file(path.join(wsRoot, 'src', 'a', 'b', 'c', 'deep.ts'));
			const result = mapper.getAsidePath(sourceUri);

			const expected = path.join(wsRoot, '.aside', 'src', 'a', 'b', 'c', 'deep.ts.json');
			expect(result!.fsPath).toBe(expected);
		});
	});

	describe('getSourcePath', () => {
		it('maps an aside JSON path back to the source file', () => {
			const asideUri = Uri.file(path.join(wsRoot, '.aside', 'src', 'app.ts.json'));
			const result = mapper.getSourcePath(asideUri);

			expect(result).toBeDefined();
			const expected = path.join(wsRoot, 'src', 'app.ts');
			expect(result!.fsPath).toBe(expected);
		});

		it('returns undefined for non-.json files', () => {
			const asideUri = Uri.file(path.join(wsRoot, '.aside', 'src', 'app.ts'));
			const result = mapper.getSourcePath(asideUri);

			expect(result).toBeUndefined();
		});

		it('returns undefined for paths outside the .aside folder', () => {
			const asideUri = Uri.file(path.join(wsRoot, 'src', 'app.ts.json'));
			const result = mapper.getSourcePath(asideUri);

			// relative path from .aside dir starts with '..', so returns undefined
			expect(result).toBeUndefined();
		});

		it('falls back to iterating workspaceFolders when getWorkspaceFolder returns undefined', () => {
			workspace.getWorkspaceFolder.mockReturnValue(undefined);
			const asideUri = Uri.file(path.join(wsRoot, '.aside', 'src', 'app.ts.json'));
			const result = mapper.getSourcePath(asideUri);

			expect(result).toBeDefined();
			expect(result!.fsPath).toBe(path.join(wsRoot, 'src', 'app.ts'));
		});

		it('returns undefined when no workspace folder matches', () => {
			workspace.getWorkspaceFolder.mockReturnValue(undefined);
			workspace.workspaceFolders = [makeWorkspaceFolder('/other/project')];
			const asideUri = Uri.file(path.join(wsRoot, '.aside', 'src', 'app.ts.json'));
			const result = mapper.getSourcePath(asideUri);

			expect(result).toBeUndefined();
		});
	});

	describe('folder paths', () => {
		it('maps a folder URI to an aside JSON path', () => {
			const folderUri = Uri.file(path.join(wsRoot, 'src', 'components'));
			const result = mapper.getAsidePath(folderUri);

			expect(result).toBeDefined();
			const expected = path.join(wsRoot, '.aside', 'src', 'components.json');
			expect(result!.fsPath).toBe(expected);
		});

		it('round-trips a folder path correctly', () => {
			const folderUri = Uri.file(path.join(wsRoot, 'src', 'components'));
			const asideUri = mapper.getAsidePath(folderUri)!;
			const roundTrip = mapper.getSourcePath(asideUri);

			expect(roundTrip).toBeDefined();
			expect(roundTrip!.fsPath).toBe(folderUri.fsPath);
		});
	});

	describe('round-trip', () => {
		it('getSourcePath(getAsidePath(uri)) returns the original path', () => {
			const sourceUri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const asideUri = mapper.getAsidePath(sourceUri)!;
			const roundTrip = mapper.getSourcePath(asideUri);

			expect(roundTrip).toBeDefined();
			expect(roundTrip!.fsPath).toBe(sourceUri.fsPath);
		});
	});

	describe('getStorageFolder', () => {
		it('returns the .aside folder URI for a workspace folder', () => {
			const result = mapper.getStorageFolder(wsFolder as any);
			expect(result.fsPath).toBe(path.join(wsRoot, '.aside'));
		});
	});

	describe('getWatchPattern', () => {
		it('returns a RelativePattern with the correct glob', () => {
			const result = mapper.getWatchPattern(wsFolder as any);
			expect(result).toBeInstanceOf(RelativePattern);
			expect(result.pattern).toBe('.aside/**/*.json');
		});
	});

	describe('updateStorageFolderName', () => {
		it('changes the storage folder for subsequent calls', () => {
			mapper.updateStorageFolderName('.comments');
			const sourceUri = Uri.file(path.join(wsRoot, 'src', 'app.ts'));
			const result = mapper.getAsidePath(sourceUri);

			const expected = path.join(wsRoot, '.comments', 'src', 'app.ts.json');
			expect(result!.fsPath).toBe(expected);
		});
	});
});
