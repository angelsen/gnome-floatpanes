import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {PaneManager} from './lib/paneManager.js';
import {WindowTracker} from './lib/windowTracker.js';
import {UI} from './lib/ui.js';
import {Logger} from './lib/logger.js';

export default class FloatPanesExtension extends Extension {
    private _settings?: Gio.Settings;
    private _indicator?: PanelMenu.Button;
    private _paneManager?: PaneManager;
    private _windowTracker?: WindowTracker;
    private _ui?: UI;
    private _keybindings: Map<string, number> = new Map();
    private _logger?: Logger;

    enable() {
        this._settings = this.getSettings();
        this._logger = new Logger(this);
        this._setupIndicator();
        this._paneManager = new PaneManager(this);
        this._windowTracker = new WindowTracker(this);
        this._ui = new UI(this, this._indicator, this._handleUIAction.bind(this));
        
        // Update UI with existing panes
        this._updatePanesList();
        
        // Set up keyboard shortcuts
        this._bindShortcuts();
        
        this._logger.info('enabled');
    }

    disable() {
        // Unbind shortcuts
        this._unbindShortcuts();
        
        if (this._windowTracker) {
            this._windowTracker.destroy();
            this._windowTracker = undefined;
        }
        
        if (this._ui) {
            this._ui.destroy();
            this._ui = undefined;
        }
        
        if (this._paneManager) {
            this._paneManager.destroy();
            this._paneManager = undefined;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = undefined;
        }

        if (this._logger) {
            this._logger.info('disabled');
            this._logger = undefined;
        }

        this._settings = undefined;
    }

    private _setupIndicator() {
        // Create a panel button
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // Add an icon
        const icon = new St.Icon({
            icon_name: 'window-pop-out-symbolic', // Window/pane related icon
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);

        // Add the indicator to the panel
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    private _handleUIAction(action?: string) {
        if (!this._paneManager || !this._logger) return;
        
        this._logger.debug(`Handling UI action: ${action || 'create new pane'}`);
        
        // Execute action directly - we'll handle menu closure in the UI class
        if (!action) {
            // Default action: create new pane
            this._paneManager.createNewPane();
        } else if (action === 'toggle-all') {
            this._paneManager.toggleAllPanes();
        } else if (action.startsWith('toggle:')) {
            const paneId = action.substring(7);
            this._logger.debug(`Toggling pane with ID: ${paneId}`);
            this._paneManager.togglePane(paneId);
        } else if (action.startsWith('remove:')) {
            const paneId = action.substring(7);
            this._logger.debug(`Removing pane with ID: ${paneId}`);
            this._paneManager.removePane(paneId);
        } else if (action.includes('webkit-app.js')) {
            // Create a specific pane with WebKitGTK launcher
            // Need to add size parameters to the command
            const baseCommand = action;
            
            // Get monitor geometry to calculate window size
            const monitor = global.display.get_current_monitor();
            const workArea = global.display.get_monitor_geometry(monitor);
            
            // Get width and height percentages from settings
            let widthPercent = 0.7;  // Default to 70%
            let heightPercent = 0.7; // Default to 70%
            
            if (this._settings) {
                widthPercent = this._settings.get_int('default-width-percent') / 100;
                heightPercent = this._settings.get_int('default-height-percent') / 100;
            }
            
            // Calculate size based on screen dimensions and settings
            const width = Math.floor(workArea.width * widthPercent);
            const height = Math.floor(workArea.height * heightPercent);
            
            // Extract URL and title from command
            const parts = baseCommand.split(' ');
            if (parts.length >= 3) {
                const webkitPath = parts[0];
                const url = parts[1];
                const title = parts[2];
                
                // Create command with size parameters
                const fullCommand = `${webkitPath} ${url} ${title} ${width} ${height}`;
                this._paneManager?.createNewPane(fullCommand);
            } else {
                // Fallback to original command if parsing fails
                this._paneManager?.createNewPane(action);
            }
        }
        
        // Update UI to reflect changes
        this._updatePanesList();
    }
    
    private _updatePanesList() {
        if (!this._paneManager || !this._ui) return;
        
        const panes = this._paneManager.getPanes();
        this._ui.updatePanesList(panes);
    }
    
    private _bindShortcuts() {
        // Get the global GNOME display instance
        const display = global.display;
        
        // Create toggle shortcut
        const toggleShortcut = this._settings?.get_strv('pane-toggle-shortcut');
        if (toggleShortcut && toggleShortcut.length > 0 && toggleShortcut[0].length > 0) {
            const keyBinding = this._addKeybinding('pane-toggle-shortcut', () => {
                this._paneManager?.toggleAllPanes();
                this._updatePanesList();
            });
            
            if (keyBinding) {
                this._keybindings.set('pane-toggle-shortcut', keyBinding);
            }
        }
    }
    
    private _unbindShortcuts() {
        // Clean up all key bindings
        for (const [name, keyBindingId] of this._keybindings.entries()) {
            Main.wm.removeKeybinding(name);
        }
        this._keybindings.clear();
    }
    
    private _addKeybinding(name: string, callback: () => void): number | null {
        try {
            // Add the keybinding directly using the settings object
            Main.wm.addKeybinding(
                name,
                this._settings!,
                Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                Shell.ActionMode.NORMAL,
                callback
            );
            
            return 1; // Just a placeholder, real ID handling would be more complex
        } catch (e) {
            this._logger?.error(`Failed to add keybinding ${name}:`, e);
            return null;
        }
    }

    getSettings(): Gio.Settings {
        return this._settings ?? super.getSettings();
    }
}