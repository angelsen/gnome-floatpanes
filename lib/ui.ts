import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Pane} from './paneManager.js';

export class UI {
    private _extension: any;
    private _indicator: any;
    private _menu: any;
    private _paneListSection: PopupMenu.PopupMenuSection;
    private _panesMenuItems: Map<string, PopupMenu.PopupMenuItem> = new Map();
    private _updatePanesCallback: (action?: string) => void;
    
    constructor(extension: any, indicator: any, updatePanesCallback: (action?: string) => void) {
        this._extension = extension;
        this._indicator = indicator;
        this._menu = this._indicator.menu;
        this._updatePanesCallback = updatePanesCallback;
        
        // Create sections for our menu
        this._paneListSection = new PopupMenu.PopupMenuSection();
        
        // Build the menu structure
        this._rebuildMenu();
    }
    
    destroy() {
        // For GNOME Shell UI components, we rely on their own cleanup
        // Just clear our references to allow garbage collection
        this._panesMenuItems.clear();
    }
    
    _rebuildMenu() {
        // Clear existing menu items
        this._menu.removeAll();
        this._panesMenuItems.clear();

        // Create New Pane item
        let newPaneItem = new PopupMenu.PopupMenuItem('New Floating Pane');
        newPaneItem.connect('activate', () => {
            this._updatePanesCallback();
        });
        this._menu.addMenuItem(newPaneItem);

        // Add Claude pane item
        let claudePaneItem = new PopupMenu.PopupMenuItem('New Claude Pane');
        claudePaneItem.connect('activate', () => {
            const webkitAppPath = `${this._extension.path}/webkit-app.js`;
            this._updatePanesCallback(`${webkitAppPath} https://claude.ai/new "Claude AI"`);
        });
        this._menu.addMenuItem(claudePaneItem);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Add Pane List section
        this._menu.addMenuItem(this._paneListSection);

        // Add a separator
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Toggle all panes
        let togglePanesItem = new PopupMenu.PopupMenuItem('Toggle All Panes');
        togglePanesItem.connect('activate', () => {
            this._updatePanesCallback('toggle-all');
        });
        this._menu.addMenuItem(togglePanesItem);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings item
        let settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this._menu.addMenuItem(settingsItem);
    }
    
    updatePanesList(panes: Pane[]) {
        // First, clear stored references so callbacks don't modify them during update
        this._panesMenuItems.clear();
        
        // Now create a fresh section instead of clearing existing one
        // This avoids issues with accessing disposed objects during callback chains
        const newSection = new PopupMenu.PopupMenuSection();
        
        if (panes.length === 0) {
            // Add a placeholder message if no panes
            const noItemsLabel = new PopupMenu.PopupMenuItem('No panes created yet');
            noItemsLabel.sensitive = false;
            newSection.addMenuItem(noItemsLabel);
        } else {
            // Add menu items for each pane
            for (const pane of panes) {
                // Skip panes with empty commands
                if (!pane.command || pane.command.trim() === '') {
                    continue;
                }
                
                // Create a readable name from the command
                let displayName = pane.command;
                if (displayName.includes('claude.ai')) {
                    displayName = 'Claude AI';
                } else if (displayName.length > 30) {
                    // Truncate if too long
                    displayName = displayName.substring(0, 27) + '...';
                }
                
                const menuItem = new PopupMenu.PopupMenuItem(displayName);
                
                // Add icon to indicate visibility state
                const icon = new St.Icon({
                    icon_name: pane.visible ? 'eye-open-symbolic' : 'eye-not-looking-symbolic',
                    style_class: 'popup-menu-icon',
                });
                menuItem.insert_child_at_index(icon, 0);
                
                // Create a closure with the pane ID to prevent access to the pane object later
                const paneId = pane.id;
                
                // Add toggle button with the signal ID stored
                menuItem.connect('activate', () => {
                    // Store paneId before closing menu to avoid any reference issues
                    const idToToggle = paneId;
                    
                    // Close menu first to avoid UI issues
                    this._menu.close();
                    
                    // Call the callback directly with the stored ID
                    this._updatePanesCallback('toggle:' + idToToggle);
                });
                
                // Add close button
                const closeButton = new St.Button({
                    style_class: 'pane-close-button',
                    child: new St.Icon({
                        icon_name: 'window-close-symbolic',
                        style_class: 'popup-menu-icon',
                    }),
                });
                closeButton.connect('clicked', (button) => {
                    // Store paneId before closing menu to avoid any reference issues
                    const idToRemove = paneId;
                    
                    // Close menu first to avoid UI issues
                    this._menu.close();
                    
                    // Call the callback directly with the stored ID
                    this._updatePanesCallback('remove:' + idToRemove);
                    
                    return Clutter.EVENT_STOP;
                });
                
                menuItem.add_child(closeButton);
                newSection.addMenuItem(menuItem);
                this._panesMenuItems.set(paneId, menuItem);
            }
        }
        
        // Replace the old section with the new one
        const menuItems = this._menu._getMenuItems();
        const sectionIndex = menuItems.indexOf(this._paneListSection);
        
        if (sectionIndex !== -1) {
            // Remove the old section which automatically cleans up its signals
            this._paneListSection.destroy();
            
            // Add the new section
            this._menu.addMenuItem(newSection, sectionIndex);
            this._paneListSection = newSection;
        }
    }
    
    updatePaneVisibility(paneId: string, visible: boolean) {
        const menuItem = this._panesMenuItems.get(paneId);
        if (!menuItem) return;
        
        // Update icon
        const icon = menuItem.get_children()[0] as St.Icon;
        if (icon) {
            icon.icon_name = visible ? 'eye-open-symbolic' : 'eye-not-looking-symbolic';
        }
    }
}