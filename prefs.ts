import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class FloatPanesPreferences extends ExtensionPreferences {
    _settings?: Gio.Settings;

    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        this._settings = this.getSettings();

        // Create general page
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(generalPage);

        // Behavior group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Configure how floating panes behave'),
        });
        generalPage.add(behaviorGroup);
        
        // Add a debug mode switch
        const debugModeRow = new Adw.SwitchRow({
            title: _('Debug Mode'),
            subtitle: _('Enable detailed logging for troubleshooting'),
        });
        behaviorGroup.add(debugModeRow);
        this._settings.bind('debug-mode', debugModeRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Always on top switch
        const alwaysOnTopRow = new Adw.SwitchRow({
            title: _('Always on top'),
            subtitle: _('Keep floating panes above other windows'),
        });
        behaviorGroup.add(alwaysOnTopRow);
        this._settings.bind('always-on-top', alwaysOnTopRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Remember position switch
        const rememberPositionRow = new Adw.SwitchRow({
            title: _('Remember position'),
            subtitle: _('Save and restore pane positions between sessions'),
        });
        behaviorGroup.add(rememberPositionRow);
        this._settings.bind('remember-position', rememberPositionRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Remember size switch
        const rememberSizeRow = new Adw.SwitchRow({
            title: _('Remember size'),
            subtitle: _('Save and restore pane sizes between sessions'),
        });
        behaviorGroup.add(rememberSizeRow);
        this._settings.bind('remember-size', rememberSizeRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        // Sizing group
        const sizingGroup = new Adw.PreferencesGroup({
            title: _('Window Size'),
            description: _('Configure default size of floating panes'),
        });
        generalPage.add(sizingGroup);
        
        // Default width percentage
        const widthRow = new Adw.SpinRow({
            title: _('Default width'),
            subtitle: _('Width as percentage of screen size'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 5,
                value: this._settings.get_int('default-width-percent'),
            }),
        });
        sizingGroup.add(widthRow);
        this._settings.bind('default-width-percent', widthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        
        // Default height percentage
        const heightRow = new Adw.SpinRow({
            title: _('Default height'),
            subtitle: _('Height as percentage of screen size'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 5,
                value: this._settings.get_int('default-height-percent'),
            }),
        });
        sizingGroup.add(heightRow);
        this._settings.bind('default-height-percent', heightRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        // Create shortcuts page
        const shortcutsPage = new Adw.PreferencesPage({
            title: _('Shortcuts'),
            icon_name: 'input-keyboard-symbolic',
        });
        window.add(shortcutsPage);

        // Keyboard shortcuts group
        const shortcutsGroup = new Adw.PreferencesGroup({
            title: _('Keyboard Shortcuts'),
            description: _('Configure keyboard shortcuts'),
        });
        shortcutsPage.add(shortcutsGroup);

        // Toggle panes shortcut
        this._addShortcutRow(shortcutsGroup, 'pane-toggle-shortcut', _('Toggle panes'), _('Keyboard shortcut to toggle all floating panes'));

        return Promise.resolve();
    }

    private _addShortcutRow(group: Adw.PreferencesGroup, settingName: string, title: string, subtitle: string) {
        const shortcutsRow = new Adw.ActionRow({
            title,
            subtitle,
        });

        const shortcutLabel = new Gtk.ShortcutLabel({
            accelerator: this._getCurrentAccelerator(settingName),
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
        });

        const editButton = new Gtk.Button({
            icon_name: 'edit-symbolic',
            valign: Gtk.Align.CENTER,
        });

        editButton.connect('clicked', () => {
            // TODO: Implement shortcut editing
            // console.log() is recommended over console.debug() in prefs.ts
            // since debug won't show without debug-mode enabled
            console.log(`Edit shortcut for ${settingName} (not implemented yet)`);
        });

        shortcutsRow.add_suffix(shortcutLabel);
        shortcutsRow.add_suffix(editButton);
        group.add(shortcutsRow);
    }

    private _getCurrentAccelerator(settingName: string): string {
        const strv = this._settings!.get_strv(settingName);
        return strv.length > 0 ? strv[0] : '';
    }
}