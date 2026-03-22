import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		include: ['test/**/*.test.ts'],
		setupFiles: ['./test/setup.ts'],
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, 'test/__mocks__/vscode.ts'),
		},
	},
});
