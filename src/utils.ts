import { exec, execSync } from 'child_process';
import { existsSync } from 'fs';
import { normalizePath, Notice, TFile, Vault, Workspace } from 'obsidian';
import * as path from 'path';

export function isCliInstalled(): boolean {
	try {
		execSync('archwiki-rs -h');
		return true;
	} catch (_e) {
		return false;
	}
}

export function pageFileExists(): boolean {
	try {
		const filePath = path.join(
			execSync('archwiki-rs info -d -o', { encoding: 'utf8' }).trim(),
			'pages.yml'
		);
		return existsSync(filePath);
	} catch (_e) {
		new Notice(_e);
		return false;
	}
}

export function createPageFile() {
	exec('archwiki-rs update-all', {}, (err) => {
		if (err) {
			const notice = new Notice(
				"Failed to create page file. Try running the command 'archwiki-rs update-all' manually."
			);
			notice.noticeEl.addClass('archwiki-error-notice');
		} else {
			const notice = new Notice('Finished fetching pages from the ArchWiki');
			notice.noticeEl.addClass('archwiki-success-notice');
		}
	});
}

export async function createIfNotExists(
	filename: string,
	dir: string,
	content: string,
	vault: Vault
): Promise<TFile> {
	const filePath = normalizePath(path.join(dir, `${filename}.md`));

	let file: TFile;
	if (await vault.adapter.exists(filePath)) {
		file = vault.getAbstractFileByPath(filePath) as TFile;
	} else {
		file = await vault.create(filePath, content);
	}

	return file;
}

export async function openFileInTab(file: TFile, workspace: Workspace) {
	const leaf = workspace.getLeaf('tab');
	await leaf.openFile(file);
}

export function newlineStringToModalList(pages: string): string[] {
	return pages
		.trim()
		.split('\n')
		.filter((s) => s.trim() !== ' ');
}

export function pageToSaveFilename(page: string): string {
	return page.replace(/[^-0-9A-Za-z_]/g, '_');
}
