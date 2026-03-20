import { COMMENT_COLORS, DEFAULT_COMMENT_COLOR } from '../types';

export function getPanelHtml(
	nonce: string,
	cspSource: string
): string {
	// Generate CSS classes for each predefined color (CSP blocks inline styles)
	const colorCssClasses = COMMENT_COLORS.map(
		(c, i) => `.color-dot-${i} { background-color: ${c}; }`
	).join('\n    ');

	const colorDots = COMMENT_COLORS.map(
		(c, i) => `<button class="color-dot color-dot-${i}" data-color="${c}" title="${c}"></button>`
	).join('');

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style nonce="${nonce}">
		:root {
			--card-bg: var(--vscode-editor-background);
			--card-border: var(--vscode-panel-border, var(--vscode-widget-border, #444));
			--card-hover-bg: var(--vscode-list-hoverBackground);
			--text-primary: var(--vscode-foreground);
			--text-secondary: var(--vscode-descriptionForeground);
			--accent: var(--vscode-textLink-foreground);
			--orphaned-bg: rgba(255, 107, 107, 0.1);
			--orphaned-border: #FF6B6B;
			--input-bg: var(--vscode-input-background, #1e1e1e);
			--input-border: var(--vscode-input-border, #3c3c3c);
			--input-fg: var(--vscode-input-foreground, #ccc);
			--btn-bg: var(--vscode-button-background, #0e639c);
			--btn-fg: var(--vscode-button-foreground, #fff);
			--btn-hover: var(--vscode-button-hoverBackground, #1177bb);
		}

		body {
			margin: 0;
			padding: 8px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--text-primary);
			background: transparent;
		}

		/* Color dot classes (generated to avoid inline styles blocked by CSP) */
		${colorCssClasses}

		/* Add/Edit Form */
		.comment-form {
			display: none;
			border: 1px solid var(--input-border);
			border-radius: 4px;
			padding: 10px;
			margin-bottom: 10px;
			background: var(--card-bg);
			border-left: 3px solid ${DEFAULT_COMMENT_COLOR};
		}

		.comment-form.visible {
			display: block;
		}

		.form-label {
			font-size: 0.85em;
			font-weight: 600;
			margin-bottom: 6px;
			color: var(--accent);
		}

		.comment-textarea {
			width: 100%;
			min-height: 80px;
			max-height: 200px;
			resize: vertical;
			background: var(--input-bg);
			color: var(--input-fg);
			border: 1px solid var(--input-border);
			border-radius: 3px;
			padding: 6px 8px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			box-sizing: border-box;
			line-height: 1.4;
		}

		.comment-textarea:focus {
			outline: 1px solid var(--accent);
			border-color: var(--accent);
		}

		.color-picker {
			display: flex;
			gap: 5px;
			margin: 8px 0;
			align-items: center;
			flex-wrap: wrap;
		}

		.color-picker-label {
			font-size: 0.8em;
			color: var(--text-secondary);
			margin-right: 2px;
		}

		.color-dot {
			width: 16px;
			height: 16px;
			border-radius: 50%;
			border: 2px solid transparent;
			cursor: pointer;
			padding: 0;
			transition: transform 0.15s ease;
		}

		.color-dot:hover {
			transform: scale(1.25);
		}

		.color-dot.selected {
			transform: scale(1.35);
			border-color: var(--text-primary);
		}

		/* Hidden native color input (triggered by eyedropper button) */
		.native-color-input {
			opacity: 0;
			position: absolute;
			width: 0;
			height: 0;
			padding: 0;
			border: 0;
			overflow: hidden;
			pointer-events: none;
		}

		/* Eyedropper button (replaces visible color input) */
		.eyedropper-btn {
			width: 16px;
			height: 16px;
			border-radius: 50%;
			border: 2px solid var(--card-border);
			cursor: pointer;
			padding: 0;
			margin-left: 4px;
			background: var(--input-bg);
			display: flex;
			align-items: center;
			justify-content: center;
			transition: transform 0.15s ease, border-color 0.15s ease;
			position: relative;
		}

		.eyedropper-btn:hover {
			transform: scale(1.25);
		}

		.eyedropper-btn.selected {
			transform: scale(1.35);
			border-color: var(--text-primary);
		}

		.eyedropper-btn svg {
			width: 10px;
			height: 10px;
			stroke: var(--text-secondary);
			fill: none;
			stroke-width: 1.5;
			stroke-linecap: round;
			stroke-linejoin: round;
		}

		.eyedropper-btn:hover svg {
			stroke: var(--text-primary);
		}

		.form-actions {
			display: flex;
			gap: 6px;
			margin-top: 8px;
		}

		.btn {
			padding: 4px 12px;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 0.85em;
			font-family: var(--vscode-font-family);
		}

		.btn-primary {
			background: var(--btn-bg);
			color: var(--btn-fg);
		}

		.btn-primary:hover {
			background: var(--btn-hover);
		}

		.btn-secondary {
			background: var(--vscode-button-secondaryBackground, #333);
			color: var(--vscode-button-secondaryForeground, #ccc);
		}

		.btn-secondary:hover {
			background: var(--vscode-button-secondaryHoverBackground, #444);
		}

		/* Comment cards */
		.comment-card {
			border: 1px solid var(--card-border);
			border-radius: 4px;
			padding: 8px 10px;
			margin-bottom: 8px;
			cursor: pointer;
			transition: background 0.15s;
			position: relative;
			border-left: 3px solid ${DEFAULT_COMMENT_COLOR};
		}

		.comment-card:hover {
			background: var(--card-hover-bg);
		}

		.comment-card.orphaned {
			border-left-color: var(--orphaned-border);
			background: var(--orphaned-bg);
		}

		.comment-header {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 4px;
			flex-wrap: wrap;
		}

		.comment-line-range {
			font-weight: 600;
			font-size: 0.85em;
			color: var(--accent);
		}

		.comment-author {
			font-size: 0.85em;
			color: var(--text-secondary);
		}

		.comment-date {
			font-size: 0.8em;
			color: var(--text-secondary);
			margin-left: auto;
		}

		.badge {
			font-size: 0.7em;
			padding: 1px 5px;
			border-radius: 3px;
			font-weight: 600;
			text-transform: uppercase;
		}

		.orphaned-badge {
			background: var(--orphaned-border);
			color: white;
		}

		.comment-text {
			font-size: 0.9em;
			line-height: 1.4;
			white-space: pre-wrap;
			word-break: break-word;
		}

		.comment-actions {
			display: none;
			justify-content: flex-end;
			gap: 4px;
			margin-top: 6px;
			padding-top: 6px;
			border-top: 1px solid var(--card-border);
		}

		.comment-card:hover .comment-actions {
			display: flex;
		}

		.action-btn {
			background: var(--vscode-button-secondaryBackground, #333);
			border: none;
			border-radius: 3px;
			padding: 3px 8px;
			cursor: pointer;
			font-size: 0.8em;
			color: var(--text-secondary);
			display: flex;
			align-items: center;
			gap: 3px;
			transition: color 0.15s, background 0.15s;
		}

		.action-btn:hover {
			background: var(--vscode-button-secondaryHoverBackground, #444);
			color: var(--text-primary);
		}

		.action-btn svg {
			width: 14px;
			height: 14px;
			fill: currentColor;
		}

		.empty-state {
			text-align: center;
			padding: 24px 16px;
			color: var(--text-secondary);
		}

		.empty-state .hint {
			font-size: 0.85em;
			margin-top: 8px;
		}

		kbd {
			background: var(--vscode-keybindingLabel-background, #333);
			border: 1px solid var(--vscode-keybindingLabel-border, #555);
			border-radius: 3px;
			padding: 1px 4px;
			font-family: var(--vscode-editor-font-family);
			font-size: 0.9em;
		}

		.file-header {
			font-size: 0.85em;
			color: var(--text-secondary);
			padding: 4px 0 8px 0;
			border-bottom: 1px solid var(--card-border);
			margin-bottom: 8px;
		}

		.comment-count {
			font-weight: 600;
			color: var(--text-primary);
		}
	</style>
</head>
<body>
	<div id="add-form" class="comment-form">
		<div class="form-label" id="form-label">Add comment</div>
		<textarea class="comment-textarea" id="form-textarea" placeholder="Write your comment..."></textarea>
		<div class="color-picker">
			<span class="color-picker-label">Color:</span>
			${colorDots}
			<input type="color" class="native-color-input" id="native-color" value="${DEFAULT_COMMENT_COLOR}">
			<button class="eyedropper-btn" id="eyedropper-btn" title="Custom color">
				<svg viewBox="0 0 24 24"><path d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.41-1.42-1.42 1.42 1.42 1.41-7.07 7.07a1 1 0 0 0-.29.71V19h3.41a1 1 0 0 0 .71-.29l7.07-7.07 1.41 1.42 1.42-1.42-1.42-1.41 3.13-3.12a1 1 0 0 0 0-1.48zM7.59 17H6v-1.59l7.07-7.07 1.59 1.59L7.59 17z"/></svg>
			</button>
		</div>
		<div class="form-actions">
			<button class="btn btn-primary" id="form-submit">Save</button>
			<button class="btn btn-secondary" id="form-cancel">Cancel</button>
		</div>
	</div>
	<div id="file-header" class="file-header" style="display:none">
		<span class="comment-count" id="comment-count">0</span> comment<span id="comment-plural">s</span>
	</div>
	<div id="comments-container"></div>
	<div id="empty-state" class="empty-state" style="display:none">
		<p>No comments in this file.</p>
		<p class="hint">Select code and press <kbd>Ctrl+Shift+M</kbd> to add one.</p>
	</div>

	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();

		const PREDEFINED_COLORS = ${JSON.stringify(COMMENT_COLORS)};
		const DEFAULT_COLOR = '${DEFAULT_COMMENT_COLOR}';

		// SVG icons (Material Design style)
		const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
		const ICON_DELETE = '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

		let comments = [];
		let formMode = null; // null | 'add' | 'edit'
		let editingId = null;
		let addContext = null;
		let selectedColor = DEFAULT_COLOR;

		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		function updateColorSelection() {
			const isPredefined = PREDEFINED_COLORS.includes(selectedColor);

			document.querySelectorAll('.color-dot').forEach(dot => {
				dot.classList.toggle('selected', dot.dataset.color === selectedColor);
			});

			const nativeInput = document.getElementById('native-color');
			const eyedropperBtn = document.getElementById('eyedropper-btn');
			const isCustom = !isPredefined;
			nativeInput.value = selectedColor;
			eyedropperBtn.classList.toggle('selected', isCustom);
			eyedropperBtn.style.backgroundColor = isCustom ? selectedColor : '';
			eyedropperBtn.style.borderColor = isCustom ? 'var(--text-primary)' : '';

			// Update form left border color
			const form = document.getElementById('add-form');
			form.style.borderLeftColor = selectedColor;
		}

		function render() {
			const container = document.getElementById('comments-container');
			const header = document.getElementById('file-header');
			const empty = document.getElementById('empty-state');
			const count = document.getElementById('comment-count');
			const plural = document.getElementById('comment-plural');

			if (comments.length === 0) {
				header.style.display = 'none';
				empty.style.display = formMode ? 'none' : 'block';
				container.innerHTML = '';
				return;
			}

			empty.style.display = 'none';
			header.style.display = 'block';
			count.textContent = comments.length;
			plural.textContent = comments.length !== 1 ? 's' : '';

			const sorted = [...comments].sort((a, b) => a.lineStart - b.lineStart);
			container.innerHTML = sorted.map(c => {
				const date = new Date(c.updatedAt).toLocaleDateString(undefined, {
					year: 'numeric', month: 'short', day: 'numeric',
				});
				const isFileLevel = c.lineStart === -1 && c.lineEnd === -1;
				const lineRange = isFileLevel
					? 'File'
					: c.lineStart === c.lineEnd
						? 'Line ' + (c.lineStart + 1)
						: 'Lines ' + (c.lineStart + 1) + '\\u2013' + (c.lineEnd + 1);
				const orphanedClass = c.orphaned ? ' orphaned' : '';
				const orphanedBadge = c.orphaned
					? '<span class="badge orphaned-badge">orphaned</span>'
					: '';

				return '<div class="comment-card' + orphanedClass + '" data-id="' + c.id + '" data-line-start="' + c.lineStart + '" data-line-end="' + c.lineEnd + '" data-color="' + escapeHtml(c.color || DEFAULT_COLOR) + '">'
					+ '<div class="comment-header">'
					+ '<span class="comment-line-range">' + lineRange + '</span>'
					+ orphanedBadge
					+ '<span class="comment-author">' + escapeHtml(c.author) + '</span>'
					+ '<span class="comment-date">' + date + '</span>'
					+ '</div>'
					+ '<div class="comment-text">' + escapeHtml(c.text) + '</div>'
					+ '<div class="comment-actions">'
					+ '<button class="action-btn edit-btn" data-id="' + c.id + '" title="Edit">' + ICON_EDIT + ' Edit</button>'
					+ '<button class="action-btn delete-btn" data-id="' + c.id + '" title="Delete">' + ICON_DELETE + ' Delete</button>'
					+ '</div>'
					+ '</div>';
			}).join('');

			// Apply border colors via JS (CSP blocks inline style attributes)
			container.querySelectorAll('.comment-card').forEach(card => {
				if (!card.classList.contains('orphaned')) {
					card.style.borderLeftColor = card.dataset.color;
				}
			});
		}

		function showForm(mode, label, text, color) {
			formMode = mode;
			selectedColor = color || DEFAULT_COLOR;
			const form = document.getElementById('add-form');
			const formLabel = document.getElementById('form-label');
			const textarea = document.getElementById('form-textarea');
			const submitBtn = document.getElementById('form-submit');

			formLabel.textContent = label;
			textarea.value = text || '';
			submitBtn.textContent = mode === 'edit' ? 'Update' : 'Save';
			form.classList.add('visible');

			updateColorSelection();
			setTimeout(() => textarea.focus(), 50);
		}

		function hideForm() {
			formMode = null;
			editingId = null;
			addContext = null;
			document.getElementById('add-form').classList.remove('visible');
		}

		// Predefined color dots
		document.querySelectorAll('.color-dot').forEach(dot => {
			dot.addEventListener('click', (e) => {
				e.stopPropagation();
				selectedColor = dot.dataset.color;
				updateColorSelection();
			});
		});

		// Eyedropper button opens hidden native color picker
		document.getElementById('eyedropper-btn').addEventListener('click', (e) => {
			e.stopPropagation();
			document.getElementById('native-color').click();
		});

		// Native color picker — apply on input
		document.getElementById('native-color').addEventListener('input', (e) => {
			selectedColor = e.target.value;
			updateColorSelection();
		});

		// Form submit
		document.getElementById('form-submit').addEventListener('click', () => {
			const text = document.getElementById('form-textarea').value.trim();
			if (!text) return;

			if (formMode === 'add' && addContext) {
				vscode.postMessage({
					type: 'add',
					text,
					color: selectedColor,
					lineStart: addContext.lineStart,
					lineEnd: addContext.lineEnd,
					anchorContent: addContext.anchorContent,
				});
			} else if (formMode === 'edit' && editingId) {
				vscode.postMessage({
					type: 'update',
					commentId: editingId,
					text,
					color: selectedColor,
				});
			}

			hideForm();
		});

		// Form cancel
		document.getElementById('form-cancel').addEventListener('click', () => {
			hideForm();
		});

		// Ctrl+Enter to submit, Escape to cancel
		document.getElementById('form-textarea').addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault();
				document.getElementById('form-submit').click();
			}
			if (e.key === 'Escape') {
				hideForm();
			}
		});

		// Card interactions
		document.addEventListener('click', (e) => {
			const target = e.target;

			if (target.closest('.edit-btn')) {
				const id = target.closest('.edit-btn').dataset.id;
				const comment = comments.find(c => c.id === id);
				if (comment) {
					editingId = id;
					const lineRange = comment.lineStart === comment.lineEnd
						? 'Line ' + (comment.lineStart + 1)
						: 'Lines ' + (comment.lineStart + 1) + '-' + (comment.lineEnd + 1);
					showForm('edit', 'Edit comment (' + lineRange + ')', comment.text, comment.color);
				}
				e.stopPropagation();
				return;
			}

			if (target.closest('.delete-btn')) {
				const id = target.closest('.delete-btn').dataset.id;
				vscode.postMessage({ type: 'delete', commentId: id });
				e.stopPropagation();
				return;
			}

			const card = target.closest('.comment-card');
			if (card) {
				const lineStart = parseInt(card.dataset.lineStart, 10);
				const lineEnd = parseInt(card.dataset.lineEnd, 10);
				if (lineStart >= 0 && lineEnd >= 0) {
					vscode.postMessage({ type: 'scrollTo', lineStart, lineEnd });
				}
			}
		});

		// Handle messages from extension
		window.addEventListener('message', (event) => {
			const msg = event.data;
			switch (msg.type) {
				case 'updateComments':
					comments = msg.comments || [];
					render();
					break;
				case 'startAdd':
					addContext = {
						lineStart: msg.lineStart,
						lineEnd: msg.lineEnd,
						lineLabel: msg.lineLabel,
						anchorContent: msg.anchorContent,
					};
					showForm('add', 'Add comment for ' + msg.lineLabel, '', null);
					break;
				case 'startEdit': {
					const comment = comments.find(c => c.id === msg.commentId);
					if (comment) {
						editingId = msg.commentId;
						const lineRange = comment.lineStart === comment.lineEnd
							? 'Line ' + (comment.lineStart + 1)
							: 'Lines ' + (comment.lineStart + 1) + '-' + (comment.lineEnd + 1);
						showForm('edit', 'Edit comment (' + lineRange + ')', comment.text, comment.color);
					}
					break;
				}
			}
		});

		// Initial render
		render();

		// Signal that the webview is ready to receive messages
		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
}
