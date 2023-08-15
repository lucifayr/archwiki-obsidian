import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { normalizePath, Notice, TFile, Vault, Workspace } from 'obsidian';
import * as path from 'path';

/**
 * Check if `archwiki-rs` is installed
 */
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
		const info = execSync('archwiki-rs info -d -o', { encoding: 'utf8' });
		const filePath = path.join(info.trim(), 'pages.yml');

		return existsSync(filePath);
	} catch (_e) {
		return false;
	}
}

export function createPageFile() {
	try {
		execSync('archwiki-rs update-all');

		const notice = new Notice('Finished fetching pages from the ArchWiki');
		notice.noticeEl.addClass('archwiki-success-notice');
	} catch (err) {
		const notice = new Notice(
			"Failed to create page file. Try running the command 'archwiki-rs update-all' manually."
		);
		notice.noticeEl.addClass('archwiki-error-notice');
	}
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

/**
 * Convert newline separated output of archwiki-rs commands to string array.
 * Removes empty lines.
 */
export function newlineStringToModalList(pages: string): string[] {
	return pages
		.trim()
		.split('\n')
		.filter((s) => s.trim() !== ' ');
}

/**
 * Convert string page name to a filename that is save to write to the file system.
 *
 * Unsafe page names would be for example `/etc/fstab` and `.NET`. Both of these file
 * names have effects on the file system that are unwanted.
 */
export function pageToSaveFilename(page: string): string {
	return page.replace(/[^-0-9A-Za-z_]/g, '_');
}
