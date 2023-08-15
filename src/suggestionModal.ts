import { App, FuzzySuggestModal } from 'obsidian';

export class ArchWikiFuzzySuggestionModal extends FuzzySuggestModal<string> {
	#items: string[];
	#noSuggestion: boolean;
	#onConfirm: (item: string) => void;

	constructor(
		app: App,
		items: string[],
		onConfirm: (item: string) => void,
		placeholder: string
	) {
		super(app);

		this.#items = items;
		this.#onConfirm = onConfirm;

		this.setPlaceholder(placeholder);
		this.limit = 5000;

		this.scope.register(['Ctrl'], 'p', () => {
			this.inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
		});

		this.scope.register(['Ctrl'], 'n', () => {
			this.inputEl.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'ArrowDown' })
			);
		});

		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: 'ctrl p/n', purpose: 'to navigate' },
			{ command: 'ctrl k/j', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to use' },
			{ command: 'esc', purpose: 'to dismiss' }
		]);
	}

	getItems(): string[] {
		return this.#items;
	}

	getItemText(item: string): string {
		this.#noSuggestion = false;
		return item;
	}

	onNoSuggestion(): void {
		this.#noSuggestion = true;
	}

	onChooseItem(item: string, _evt: MouseEvent | KeyboardEvent): void {
		const text = this.#noSuggestion ? this.inputEl.value : item;
		this.#onConfirm(text);
	}
}
