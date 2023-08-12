import { exec, execSync } from 'child_process';
import {
	App,
	FuzzySuggestModal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Vault,
	Workspace
} from 'obsidian';
import * as path from 'path';
import {
	createIfNotExists as createFileIfNotExists,
	createPageFile,
	isCliInstalled,
	newlineStringToModalList,
	openFileInTab,
	pageFileExists,
	pageToSaveFilename
} from './utils';

type ArchWikiSettings = {
	pageDirectory: string;
};

const READ_PAGE_COMMAND = 'read-page';
const UPDATE_CATEGORY_COMMAND = 'update-category';

const DEFAULT_SETTINGS: ArchWikiSettings = {
	pageDirectory: 'ArchWiki'
};

function updateCategory(category: string) {
	exec(`archwiki-rs update-category ${category}`, { encoding: 'utf8' }, (err) => {
		if (err) {
			const notice = new Notice(`Failed to update category ${category}`);
			notice.noticeEl.addClass('archwiki-error-notice');
		} else {
			const notice = new Notice(`Updated category ${category}`);
			notice.noticeEl.addClass('archwiki-success-notice');
		}
	});
}

function openReadPageFuzzyModal(
	app: App,
	dir: string,
	vault: Vault,
	workspace: Workspace
) {
	exec('archwiki-rs list-pages -f', { encoding: 'utf8' }, (err, stdout, _stderr) => {
		if (err) {
			new Notice('Failed to get ArchWiki pages');
			return;
		}

		new ArchWikiFuzzySuggestionModal(
			app,
			newlineStringToModalList(stdout),
			async (item) => {
				exec(
					`archwiki-rs read-page -f markdown "${item}"`,
					{ encoding: 'utf8' },
					async (err, stdout, stderr) => {
						if (err) {
							const notice = new Notice(`Page ${item} not found`);
							notice.noticeEl.addClass('archwiki-error-notice');

							const similar = newlineStringToModalList(stderr);
							if (similar.length > 0) {
								new ArchWikiFuzzySuggestionModal(
									app,
									similar,
									async (item) => {
										const page = pageToSaveFilename(item);

										try {
											const content = execSync(
												`archwiki-rs read-page -f markdown "${page}"`,
												{ encoding: 'utf8' }
											);

											const file = await createFileIfNotExists(
												page,
												dir,
												content,
												vault
											);

											openFileInTab(file, workspace);
										} catch (_e) {
											const notice = new Notice(
												`Failed to read page ${page}`
											);
											notice.noticeEl.addClass(
												'archwiki-error-notice'
											);
										}
									},
									'Enter similar page name...'
								).open();
							} else {
								const notice = new Notice('No similar pages found');
								notice.noticeEl.addClass('archwiki-error-notice');
							}
						} else {
							const content = stdout;
							const page = pageToSaveFilename(item);
							const file = await createFileIfNotExists(
								page,
								dir,
								content,
								vault
							);

							openFileInTab(file, workspace);
						}
					}
				);
			},
			'Enter page name...'
		).open();
	});
}

function openUpdateCategoryFuzzyModal(app: App) {
	exec('archwiki-rs list-categories', { encoding: 'utf8' }, (err, stdout, _stderr) => {
		if (err) {
			new Notice('Failed to get categories');
			return;
		}

		const categories = stdout.trim().split('\n');
		new ArchWikiFuzzySuggestionModal(
			app,
			categories,
			(item) => updateCategory(item),
			'Enter category name...'
		).open();
	});
}

export default class ArchWikiPlugin extends Plugin {
	settings: ArchWikiSettings;

	async onload() {
		await this.loadSettings();

		if (!isCliInstalled()) {
			const notice = new Notice(
				`You have to install 'archwiki-rs' to use the plugin '${this.manifest.name}'`
			);
			notice.noticeEl.addClass('archwiki-warn-notice');

			return;
		}

		if (!pageFileExists()) {
			const notice = new Notice(
				'Fetching list of pages from the ArchWiki. This will take some time...'
			);
			notice.noticeEl.addClass('archwiki-info-notice');

			createPageFile();
		}

		const root = this.app.vault.getRoot().path;
		const dir = path.join(root, this.settings.pageDirectory);

		const exists = await this.app.vault.adapter.exists(dir);
		if (!exists) {
			await this.app.vault.adapter.mkdir(dir);
		}

		this.addSettingTab(new ArchWikiSettingTab(this.app, this));

		this.addCommand({
			id: READ_PAGE_COMMAND,
			hotkeys: [{ modifiers: ['Shift', 'Ctrl'], key: 'r' }],
			name: 'Read ArchWiki page',
			callback: () => {
				openReadPageFuzzyModal(
					this.app,
					this.settings.pageDirectory,
					this.app.vault,
					this.app.workspace
				);
			}
		});

		this.addCommand({
			id: UPDATE_CATEGORY_COMMAND,
			hotkeys: [{ modifiers: ['Shift', 'Ctrl'], key: 'u' }],
			name: 'Update pages in ArchWiki category',
			callback: () => openUpdateCategoryFuzzyModal(this.app)
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ArchWikiFuzzySuggestionModal extends FuzzySuggestModal<string> {
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

class ArchWikiSettingTab extends PluginSettingTab {
	plugin: ArchWikiPlugin;

	constructor(app: App, plugin: ArchWikiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('ArchWiki page directory')
			.setDesc('Where should downloaded ArchWiki pages be stored')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.pageDirectory)
					.onChange(async (value) => {
						this.plugin.settings.pageDirectory = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
