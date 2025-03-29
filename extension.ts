import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Will implement these modules later
// import {PaneManager} from './lib/paneManager.js';
// import {WindowTracker} from './lib/windowTracker.js';
// import {UI} from './lib/ui.js';

export default class FloatPanesExtension extends Extension {
    private _settings?: Gio.Settings;
    private _indicator?: PanelMenu.Button;
    // private _paneManager?: PaneManager;
    // private _windowTracker?: WindowTracker;

    enable() {
        this._settings = this.getSettings();
        this._setupIndicator();
        // this._paneManager = new PaneManager(this);
        // this._windowTracker = new WindowTracker(this);
        
        console.log(`${this.metadata.name}: enabled`);
    }

    disable() {
        // if (this._windowTracker) {
        //     this._windowTracker.destroy();
        //     this._windowTracker = undefined;
        // }
        
        // if (this._paneManager) {
        //     this._paneManager.destroy();
        //     this._paneManager = undefined;
        // }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = undefined;
        }

        this._settings = undefined;
        console.log(`${this.metadata.name}: disabled`);
    }

    private _setupIndicator() {
        // Create a panel button
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // Add an icon
        const icon = new St.Icon({
            icon_name: 'view-grid-symbolic', // Using a grid icon for now
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);

        // Create the menu
        this._buildMenu();

        // Add the indicator to the panel
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    private _buildMenu() {
        if (!this._indicator) return;

        // Type assertion to help TypeScript understand the menu structure
        const menu = this._indicator.menu as unknown as { addMenuItem(item: PopupMenu.PopupMenuBase): void };

        // Create New Pane item
        let newPaneItem = new PopupMenu.PopupMenuItem('New Floating Pane');
        newPaneItem.connect('activate', () => {
            // this._paneManager?.createNewPane();
            console.log('Creating new pane (not implemented yet)');
        });
        menu.addMenuItem(newPaneItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Toggle all panes
        let togglePanesItem = new PopupMenu.PopupMenuItem('Toggle All Panes');
        togglePanesItem.connect('activate', () => {
            // this._paneManager?.toggleAllPanes();
            console.log('Toggling all panes (not implemented yet)');
        });
        menu.addMenuItem(togglePanesItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings item
        let settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            this.openPreferences();
        });
        menu.addMenuItem(settingsItem);
    }

    getSettings(): Gio.Settings {
        return this._settings ?? super.getSettings();
    }
}