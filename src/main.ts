import { exec, execSync } from 'child_process';
import { App, Notice, Plugin, Vault, Workspace } from 'obsidian';
import * as path from 'path';

import { ArchWikiSettingTab } from './settings';
import { ArchWikiFuzzySuggestionModal } from './suggestionModal';
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

function openReadPageFuzzyModal(
	app: App,
	dir: string,
	vault: Vault,
	workspace: Workspace
) {
	let pages: string[] = [];
	try {
		const stdout = execSync('archwiki-rs list-pages -f', { encoding: 'utf8' });
		pages = newlineStringToModalList(stdout);
	} catch {
		new Notice('Failed to get ArchWiki pages');
		return;
	}

	new ArchWikiFuzzySuggestionModal(
		app,
		pages,
		async (item) => {
			exec(
				`archwiki-rs read-page -f markdown "${item}"`,
				{ encoding: 'utf8' },
				async (err, stdout, stderr) => {
					if (!err) {
						const page = pageToSaveFilename(item);
						const file = await createFileIfNotExists(
							page,
							dir,
							stdout,
							vault
						);

						openFileInTab(file, workspace);

						return;
					}

					const notice = new Notice(`Page ${item} not found`);
					notice.noticeEl.addClass('archwiki-error-notice');

					const similarPages = newlineStringToModalList(stderr);
					if (similarPages.length <= 0) {
						return;
					}

					new ArchWikiFuzzySuggestionModal(
						app,
						similarPages,
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
							} catch {
								const notice = new Notice(`Failed to read page ${page}`);
								notice.noticeEl.addClass('archwiki-error-notice');
							}
						},
						'Enter similar page name...'
					).open();
				}
			);
		},
		'Enter page name...'
	).open();
}

function openUpdateCategoryFuzzyModal(app: App) {
	try {
		const stdout = execSync('archwiki-rs list-categories', { encoding: 'utf8' });
		const categories = newlineStringToModalList(stdout);

		new ArchWikiFuzzySuggestionModal(
			app,
			categories,
			(item) => updateCategory(item),
			'Enter category name...'
		).open();
	} catch {
		new Notice('Failed to get categories');
	}
}

function updateCategory(category: string) {
	try {
		execSync(`archwiki-rs update-category "${category}"`);

		const notice = new Notice(`Updated category ${category}`);
		notice.noticeEl.addClass('archwiki-success-notice');
	} catch {
		const notice = new Notice(`Failed to update category ${category}`);
		notice.noticeEl.addClass('archwiki-error-notice');
	}
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
