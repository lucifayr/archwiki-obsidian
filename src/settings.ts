import { App, PluginSettingTab, Setting } from 'obsidian';
import ArchWikiPlugin from './main';

export class ArchWikiSettingTab extends PluginSettingTab {
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
