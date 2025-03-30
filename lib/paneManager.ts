import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export interface Pane {
    id: string;
    command: string;
    pid?: number;
    windowId?: string;
    stableSequenceId?: number; // Using get_stable_sequence() for reliable window identification
    lastPosition?: { x: number; y: number };
    lastSize?: { width: number; height: number };
    visible: boolean;
    launchTime?: number; // Timestamp when launched, used for window matching
}

export class PaneManager {
    private _extension: any;
    private _settings: Gio.Settings;
    private _panes: Map<string, Pane> = new Map();
    private _windowSignals: Map<string, number[]> = new Map();

    constructor(extension: any) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._loadSavedPanes();
        
        // Connect to window creation signal to track our panes
        global.display.connect('window-created', (_: any, window: Meta.Window) => {
            this._onWindowCreated(window);
        });
    }

    destroy() {
        // Clean up window signals
        for (const [windowId, signalIds] of this._windowSignals.entries()) {
            const window = this._getWindowById(windowId);
            if (window) {
                for (const signalId of signalIds) {
                    window.disconnect(signalId);
                }
            }
        }
        this._windowSignals.clear();
        
        // Hide all panes to save their state
        for (const pane of this._panes.values()) {
            if (pane.windowId) {
                const window = this._getWindowById(pane.windowId);
                if (window && pane.visible) {
                    this._hideWindow(window);
                    pane.visible = false;
                }
            }
        }
        
        // Save pane configurations
        this._savePanes();
    }

    createNewPane(command?: string) {
        if (!command) {
            // Default to WebKitGTK launcher with Claude
            const webkitAppPath = `${this._extension.path}/webkit-app.js`;
            command = `${webkitAppPath} https://claude.ai/new "Claude AI"`;
        }
        
        const id = GLib.uuid_string_random();
        const pane: Pane = {
            id,
            command,
            visible: true
        };
        
        this._panes.set(id, pane);
        this._launchPaneProcess(pane);
        this._savePanes();
        
        return pane;
    }

    togglePane(id: string) {
        const pane = this._panes.get(id);
        if (!pane) {
            console.error(`togglePane: No pane found with ID ${id}`);
            return;
        }
        
        console.log(`Toggling pane with command: ${pane.command}, current visibility: ${pane.visible}, windowId: ${pane.windowId || 'none'}, stableSequenceId: ${pane.stableSequenceId || 'none'}`);
        
        // First try to find window by stable sequence ID (most reliable)
        let window: Meta.Window | null = null;
        
        if (pane.stableSequenceId !== undefined) {
            window = this._getWindowByStableSequence(pane.stableSequenceId);
            if (window) {
                console.log(`Found window by stable sequence ID ${pane.stableSequenceId}, window title: ${window.get_title()}`);
            }
        }
        
        // Fall back to window ID if needed
        if (!window && pane.windowId) {
            window = this._getWindowById(pane.windowId);
            if (window) {
                console.log(`Found window with ID ${pane.windowId}, window title: ${window.get_title()}`);
                // Update the stable sequence ID for future use
                pane.stableSequenceId = window.get_stable_sequence();
                console.log(`Updated stable sequence ID to: ${pane.stableSequenceId}`);
            }
        }
        
        // If WebKit app window, try special matching for WebKit
        if (!window && pane.command.includes('webkit-app.js')) {
            window = this._findWebKitAppWindow(pane);
            if (window) {
                console.log(`Found WebKit app window by special matching, window title: ${window.get_title()}`);
                // Update IDs for future use
                pane.windowId = this._getUniqueWindowId(window);
                pane.stableSequenceId = window.get_stable_sequence();
                console.log(`Updated window ID to: ${pane.windowId}, stable sequence ID to: ${pane.stableSequenceId}`);
            }
        }
        
        // If window was found, toggle its visibility
        if (window) {
            if (pane.visible) {
                console.log('Hiding window');
                this._hideWindow(window);
                pane.visible = false;
            } else {
                console.log('Showing window');
                this._showWindow(window);
                pane.visible = true;
            }
            this._savePanes();
            return;
        }
        
        console.log('No matching window found');
        
        // If we got here, the window doesn't exist, so launch it if needed
        if (!pane.visible) {
            console.log(`Launching new process for pane: ${pane.command}`);
            pane.visible = true;
            this._launchPaneProcess(pane);
            this._savePanes();
        } else {
            console.log(`Pane marked as visible but no window found, marking as invisible`);
            pane.visible = false;
            // Clear IDs since the window no longer exists
            pane.windowId = undefined;
            pane.stableSequenceId = undefined;
            this._savePanes();
        }
    }
    
    // Method to find WebKit app windows using stable sequence ID tracking
    private _findWebKitAppWindow(pane: Pane): Meta.Window | null {
        console.log('Trying to find WebKit app window');
        
        // Get all window actors in the shell
        const windowActors = global.get_window_actors();
        console.log(`Total windows to check: ${windowActors.length}`);
        
        // If we already have a stable sequence ID, use it for reliable tracking
        if (pane.stableSequenceId !== undefined) {
            console.log(`Checking for previously matched window with stable sequence ID: ${pane.stableSequenceId}`);
            
            for (const window of windowActors) {
                const metaWindow = window.get_meta_window();
                if (!metaWindow) continue;
                
                const stableSeqId = metaWindow.get_stable_sequence();
                if (stableSeqId === pane.stableSequenceId) {
                    console.log(`Found window with matching stable sequence ID: ${stableSeqId}`);
                    return metaWindow;
                }
            }
            console.log(`No window found with stable sequence ID: ${pane.stableSequenceId}`);
        }
        
        // For newly launched processes or if stable sequence not found
        if (pane.launchTime) {
            const now = new Date().getTime();
            const launchDelta = now - pane.launchTime;
            console.log(`Time since launch: ${launchDelta}ms`);
            
            // For recently launched windows, try a time-based approach
            if (launchDelta < 20000) { // Extended to 20 seconds for slow-loading sites like Claude.ai
                console.log('Looking for recently created windows');
                
                // Sort windows by creation time (newest first)
                const sortedWindows = [...windowActors]
                    .map(actor => actor.get_meta_window())
                    .filter(window => window !== null)
                    .sort((a, b) => {
                        // Use stable sequence as a proxy for creation time
                        // Higher numbers are more recent
                        return b.get_stable_sequence() - a.get_stable_sequence();
                    });
                
                if (sortedWindows.length > 0) {
                    // Most recently created window is likely our target
                    const newest = sortedWindows[0];
                    console.log(`Found most recently created window with stable sequence: ${newest.get_stable_sequence()}`);
                    return newest;
                }
            }
        }
        
        console.log('No matching window found by any method');
        return null;
    }

    toggleAllPanes() {
        // Check if any pane is visible
        const anyVisible = Array.from(this._panes.values()).some(pane => pane.visible);
        
        // Toggle visibility - if any are visible, hide all. Otherwise, show all.
        for (const pane of this._panes.values()) {
            if (pane.windowId) {
                const window = this._getWindowById(pane.windowId);
                if (window) {
                    if (anyVisible) {
                        this._hideWindow(window);
                        pane.visible = false;
                    } else {
                        this._showWindow(window);
                        pane.visible = true;
                    }
                } else if (!anyVisible) {
                    // Window doesn't exist but we want to show it
                    pane.visible = true;
                    this._launchPaneProcess(pane);
                }
            } else if (!anyVisible) {
                // No window ID but we want to show it
                pane.visible = true;
                this._launchPaneProcess(pane);
            }
        }
        
        this._savePanes();
    }

    removePane(id: string) {
        const pane = this._panes.get(id);
        if (!pane) return;
        
        // If there's a window, close it
        if (pane.windowId) {
            const window = this._getWindowById(pane.windowId);
            if (window) {
                window.delete(global.get_current_time());
            }
        }
        
        // Remove from our map
        this._panes.delete(id);
        this._savePanes();
    }

    getPanes(): Pane[] {
        return Array.from(this._panes.values());
    }

    private _launchPaneProcess(pane: Pane) {
        try {
            // Verify the command is not empty
            if (!pane.command || pane.command.trim() === '') {
                console.error('Cannot launch pane with empty command');
                return;
            }
            
            // Using GLib.spawn_command_line_async
            let pid = 0;
            const success = GLib.spawn_command_line_async(pane.command);
            if (success) {
                // We can't get PID directly from this function
                // We'll rely on window matching heuristics instead
                console.log(`Launched pane with command: ${pane.command}`);
                
                // Add a special tracker to match the window when it's created
                // This will be checked in _onWindowCreated
                const timeNow = new Date().getTime();
                pane.launchTime = timeNow;
                
                // Set a timeout to check if the window was matched
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
                    // If we still don't have a windowId after 5 seconds, log an error
                    if (pane.launchTime === timeNow && !pane.windowId) {
                        console.error(`Failed to match window for command: ${pane.command} after 5 seconds`);
                    }
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                console.error(`Failed to launch command: ${pane.command}`);
            }
        } catch (e) {
            console.error(`Error launching command: ${pane.command}`, e);
        }
    }

    private _onWindowCreated(window: Meta.Window) {
        // Skip windows we're not interested in
        if (!this._isInterestingWindow(window)) {
            console.log(`Skipping uninteresting window: ${window.get_title()}`);
            return;
        }
        
        console.log(`New window created: ${window.get_title()} with PID: ${window.get_pid()}, Stable Sequence: ${window.get_stable_sequence()}`);
        
        // Get the app name/WM_CLASS if available
        let appName = '';
        try {
            const windowWMClass = window.get_wm_class();
            appName = windowWMClass || '';
            console.log(`Window WM_CLASS: ${appName}`);
        } catch (e) {
            console.log('Could not get WM_CLASS');
        }
        
        // Check if this window belongs to one of our pane processes
        const pid = window.get_pid();
        let matchedPane: Pane | undefined;
        
        // We'll try different matching strategies
        
        // 1. First try matching by PID if we have it
        for (const pane of this._panes.values()) {
            if (pane.pid === pid) {
                matchedPane = pane;
                console.log(`Matched window by PID: ${pid} for pane: ${pane.command}`);
                break;
            }
        }
        
        // 2. Try matching by command string and recency
        if (!matchedPane) {
            const windowTitle = window.get_title();
            
            for (const pane of this._panes.values()) {
                // Skip panes that already have a window with valid stable sequence
                if (pane.stableSequenceId !== undefined) {
                    const existingWindow = this._getWindowByStableSequence(pane.stableSequenceId);
                    if (existingWindow) continue;
                }
                
                // Skip panes with no launch time (not recently launched)
                if (!pane.launchTime) continue;
                
                // For newly created windows, use stable sequence as primary identification
                if (pane.command.includes('webkit-app.js')) {
                    // Get stable sequence which is reliable for identification
                    const stableSeqId = window.get_stable_sequence();
                    console.log(`New window has stable sequence ID: ${stableSeqId}`);
                    
                    // The most reliable approach is to match by launch time proximity
                    const now = new Date().getTime();
                    if (pane.launchTime) {
                        const launchDelta = now - pane.launchTime;
                        console.log(`Time since launch: ${launchDelta}ms`);
                        
                        // If this window was created shortly after launching our command, it's likely ours
                        if (launchDelta < 10000) { // Within 10 seconds
                            matchedPane = pane;
                            console.log(`Matched WebKit window by launch time proximity: ${launchDelta}ms`);
                            break;
                        }
                    }
                }
                
                // For non-WebKit apps, or as a fallback, check launch time
                if (!matchedPane) {
                    const now = new Date().getTime();
                    if (pane.launchTime && (now - pane.launchTime < 10000)) {
                        // This pane was launched within the last 10 seconds
                        console.log(`Potential match based on launch time for: ${pane.command}`);
                        matchedPane = pane;
                        break;
                    }
                }
            }
        }
        
        if (!matchedPane) {
            console.log(`No matching pane found for window: ${window.get_title()}`);
            return;
        }
        
        // Store both window ID and stable sequence ID for reliable tracking
        const windowId = this._getUniqueWindowId(window);
        const stableSequenceId = window.get_stable_sequence();
        
        console.log(`Assigned window ID ${windowId} and stable sequence ${stableSequenceId} to pane with command: ${matchedPane.command}`);
        
        matchedPane.windowId = windowId;
        matchedPane.stableSequenceId = stableSequenceId;
        
        // Set up window signals
        const signals: number[] = [];
        signals.push(window.connect('position-changed', () => {
            this._onWindowPositionChanged(windowId);
        }));
        signals.push(window.connect('size-changed', () => {
            this._onWindowSizeChanged(windowId);
        }));
        this._windowSignals.set(windowId, signals);
        
        // Apply window properties
        this._setupFloatingWindow(window, matchedPane);
        
        // Save pane state
        this._savePanes();
    }

    private _setupFloatingWindow(window: Meta.Window, pane: Pane) {
        try {
            // Make sure window is valid before proceeding
            if (!window || !window.get_compositor_private()) {
                console.log('Invalid window or no compositor private found');
                return;
            }
            
            // Make window floating (not maximized, fullscreen, etc.)
            window.unmake_fullscreen();
            window.unmaximize(Meta.MaximizeFlags.BOTH);
            
            // Set always on top if enabled in settings
            const alwaysOnTop = this._settings.get_boolean('always-on-top');
            if (alwaysOnTop) {
                window.make_above();
            }
            
            // Get the monitor geometry
            const monitor = window.get_monitor();
            const workArea = global.display.get_monitor_geometry(monitor);
            
            // Process with a small delay to let the window settle first
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                try {
                    // If we don't have saved size/position or don't want to remember them,
                    // set window to default size from settings and center it
                    if ((!pane.lastSize || !this._settings.get_boolean('remember-size')) ||
                        (!pane.lastPosition || !this._settings.get_boolean('remember-position'))) {
                            
                        // Get width and height percentages from settings
                        const widthPercent = this._settings.get_int('default-width-percent') / 100;
                        const heightPercent = this._settings.get_int('default-height-percent') / 100;
                        
                        // Calculate size based on screen dimensions and settings
                        const width = Math.floor(workArea.width * widthPercent);
                        const height = Math.floor(workArea.height * heightPercent);
                        
                        // Calculate center position
                        const x = workArea.x + Math.floor((workArea.width - width) / 2);
                        const y = workArea.y + Math.floor((workArea.height - height) / 2);
                        
                        // Apply size and position - wrap in try/catch for safety
                        try {
                            if (window && window.get_compositor_private()) {
                                window.move_resize_frame(true, x, y, width, height);
                                // Save these values for future reference
                                pane.lastSize = { width, height };
                                pane.lastPosition = { x, y };
                                this._savePanes();
                                console.log(`Set window size to ${width}x${height} and position to ${x},${y}`);
                            }
                        } catch (resizeError) {
                            console.error('Error setting initial window size/position:', resizeError);
                        }
                    } else {
                        // Set size and position if we have them saved - wrap each operation in try/catch
                        if (pane.lastSize && this._settings.get_boolean('remember-size')) {
                            try {
                                if (window && window.get_compositor_private()) {
                                    const currentX = window.get_frame_rect().x;
                                    const currentY = window.get_frame_rect().y;
                                    window.move_resize_frame(true, currentX, currentY, 
                                        pane.lastSize.width, pane.lastSize.height);
                                }
                            } catch (sizeError) {
                                console.error('Error setting window size:', sizeError);
                            }
                        }
                        
                        if (pane.lastPosition && this._settings.get_boolean('remember-position')) {
                            try {
                                if (window && window.get_compositor_private()) {
                                    window.move_frame(true, pane.lastPosition.x, pane.lastPosition.y);
                                }
                            } catch (posError) {
                                console.error('Error setting window position:', posError);
                            }
                        }
                    }
                    
                    // Hide window if pane is not supposed to be visible
                    if (!pane.visible) {
                        this._hideWindow(window);
                    }
                    
                    return GLib.SOURCE_REMOVE;
                } catch (outerError) {
                    console.error('Error in window setup timeout:', outerError);
                    return GLib.SOURCE_REMOVE;
                }
            });
            
        } catch (e) {
            console.error('Error setting up floating window:', e);
        }
    }

    private _isValidWindow(window: Meta.Window | null): boolean {
        return Boolean(
            window && 
            window.get_compositor_private() !== null
        );
    }

    private _hideWindow(window: Meta.Window) {
        if (!this._isValidWindow(window)) {
            console.log('Cannot hide invalid window');
            return;
        }
        
        try {
            window.minimize();
        } catch (e) {
            console.error('Error hiding window:', e);
        }
    }

    private _showWindow(window: Meta.Window) {
        if (!this._isValidWindow(window)) {
            console.log('Cannot show invalid window');
            return;
        }
        
        try {
            window.unminimize();
            window.raise();
            window.focus(global.get_current_time());
        } catch (e) {
            console.error('Error showing window:', e);
        }
    }

    private _onWindowPositionChanged(windowId: string) {
        const window = this._getWindowById(windowId);
        if (!window) return;
        
        // Find the pane for this window
        for (const pane of this._panes.values()) {
            if (pane.windowId === windowId) {
                const rect = window.get_frame_rect();
                pane.lastPosition = { x: rect.x, y: rect.y };
                this._savePanes();
                break;
            }
        }
    }

    private _onWindowSizeChanged(windowId: string) {
        const window = this._getWindowById(windowId);
        if (!window) return;
        
        // Find the pane for this window
        for (const pane of this._panes.values()) {
            if (pane.windowId === windowId) {
                const rect = window.get_frame_rect();
                pane.lastSize = { width: rect.width, height: rect.height };
                this._savePanes();
                break;
            }
        }
    }

    private _getWindowById(windowId: string): Meta.Window | null {
        console.log(`Looking for window with ID: ${windowId}`);
        
        // Get all window actors in the shell
        const windowActors = global.get_window_actors();
        console.log(`Total windows available: ${windowActors.length}`);
        
        for (const window of windowActors) {
            const metaWindow = window.get_meta_window();
            if (metaWindow) {
                const currentId = this._getUniqueWindowId(metaWindow);
                console.log(`Window: ${metaWindow.get_title()} | ID: ${currentId}`);
                
                if (currentId === windowId) {
                    console.log(`Matched window: ${metaWindow.get_title()}`);
                    return metaWindow;
                }
            }
        }
        
        console.log(`No matching window found for ID: ${windowId}`);
        return null;
    }
    
    private _getWindowByStableSequence(sequenceId: number): Meta.Window | null {
        console.log(`Looking for window with stable sequence ID: ${sequenceId}`);
        
        // Get all window actors in the shell
        const windowActors = global.get_window_actors();
        
        for (const window of windowActors) {
            const metaWindow = window.get_meta_window();
            if (metaWindow) {
                const stableSequence = metaWindow.get_stable_sequence();
                
                if (stableSequence === sequenceId) {
                    console.log(`Matched window by stable sequence: ${metaWindow.get_title()}`);
                    return metaWindow;
                }
            }
        }
        
        console.log(`No matching window found for stable sequence ID: ${sequenceId}`);
        return null;
    }

    private _getUniqueWindowId(window: Meta.Window): string {
        // Create a unique identifier for the window combining PID and XID
        return `${window.get_pid()}-${window.get_id()}`;
    }

    private _isInterestingWindow(window: Meta.Window): boolean {
        // Skip certain types of windows
        if (window.get_window_type() !== Meta.WindowType.NORMAL) {
            return false;
        }
        
        // Skip windows without a pid (unlikely but possible)
        if (window.get_pid() <= 0) {
            return false;
        }
        
        return true;
    }

    private _savePanes() {
        try {
            // Create a dictionary object for GVariant constructor
            const panesDict: {[key: string]: GLib.Variant} = {};
            
            // Add each pane to the dictionary
            for (const [id, pane] of this._panes.entries()) {
                // For each pane, create an object with its properties
                const paneValues: {[key: string]: GLib.Variant} = {
                    'command': GLib.Variant.new_string(pane.command),
                    'visible': GLib.Variant.new_boolean(pane.visible)
                };
                
                // Add window IDs if available
                if (pane.windowId) {
                    paneValues['windowId'] = GLib.Variant.new_string(pane.windowId);
                }
                
                // Add stable sequence ID if available
                if (pane.stableSequenceId !== undefined) {
                    paneValues['stableSequenceId'] = GLib.Variant.new_int32(pane.stableSequenceId);
                }
                
                // Add position if available
                if (pane.lastPosition) {
                    const positionDict: {[key: string]: GLib.Variant} = {
                        'x': GLib.Variant.new_int32(pane.lastPosition.x),
                        'y': GLib.Variant.new_int32(pane.lastPosition.y)
                    };
                    paneValues['lastPosition'] = new GLib.Variant('a{sv}', positionDict);
                }
                
                // Add size if available
                if (pane.lastSize) {
                    const sizeDict: {[key: string]: GLib.Variant} = {
                        'width': GLib.Variant.new_int32(pane.lastSize.width),
                        'height': GLib.Variant.new_int32(pane.lastSize.height)
                    };
                    paneValues['lastSize'] = new GLib.Variant('a{sv}', sizeDict);
                }
                
                // Add the pane to the main dictionary
                panesDict[id] = new GLib.Variant('a{sv}', paneValues);
            }
            
            // Create the final variant and save it
            const variant = new GLib.Variant('a{sv}', panesDict);
            this._settings.set_value('saved-panes', variant);
        } catch (e) {
            console.error('Error saving panes:', e);
        }
    }
    
    private _loadSavedPanes() {
        try {
            const savedPanesValue = this._settings.get_value('saved-panes');
            if (!savedPanesValue) {
                return;
            }
            
            // Get the number of children in the dictionary
            const n = savedPanesValue.n_children();
            
            // Iterate through each entry in the dictionary
            for (let i = 0; i < n; i++) {
                const entry = savedPanesValue.get_child_value(i);
                const id = entry.get_child_value(0).get_string()[0];
                const paneVariant = entry.get_child_value(1);
                
                if (!id) continue;
                
                try {
                    // Create a new pane
                    const pane: Pane = {
                        id,
                        command: '',
                        visible: false
                    };
                    
                    // Extract command
                    const commandVariant = paneVariant.lookup_value('command', null);
                    if (commandVariant) {
                        pane.command = commandVariant.get_string()[0] || '';
                    }
                    
                    // Extract visible state
                    const visibleVariant = paneVariant.lookup_value('visible', null);
                    if (visibleVariant) {
                        pane.visible = visibleVariant.get_boolean();
                    }
                    
                    // Extract window ID if available
                    const windowIdVariant = paneVariant.lookup_value('windowId', null);
                    if (windowIdVariant) {
                        pane.windowId = windowIdVariant.get_string()[0] || '';
                    }
                    
                    // Extract stable sequence ID if available
                    const stableSequenceVariant = paneVariant.lookup_value('stableSequenceId', null);
                    if (stableSequenceVariant) {
                        pane.stableSequenceId = stableSequenceVariant.get_int32();
                    }
                    
                    // Extract position if available
                    const positionVariant = paneVariant.lookup_value('lastPosition', null);
                    if (positionVariant) {
                        const xVariant = positionVariant.lookup_value('x', null);
                        const yVariant = positionVariant.lookup_value('y', null);
                        
                        if (xVariant && yVariant) {
                            pane.lastPosition = {
                                x: xVariant.get_int32(),
                                y: yVariant.get_int32()
                            };
                        }
                    }
                    
                    // Extract size if available
                    const sizeVariant = paneVariant.lookup_value('lastSize', null);
                    if (sizeVariant) {
                        const widthVariant = sizeVariant.lookup_value('width', null);
                        const heightVariant = sizeVariant.lookup_value('height', null);
                        
                        if (widthVariant && heightVariant) {
                            pane.lastSize = {
                                width: widthVariant.get_int32(),
                                height: heightVariant.get_int32()
                            };
                        }
                    }
                    
                    // Add to our panes map
                    this._panes.set(id, pane);
                    
                    // Launch if it should be visible
                    if (pane.visible && pane.command) {
                        this._launchPaneProcess(pane);
                    }
                } catch (innerError) {
                    console.error('Error processing pane:', innerError);
                }
            }
        } catch (e) {
            console.error('Error loading saved panes:', e);
        }
    }
}