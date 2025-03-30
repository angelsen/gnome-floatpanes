import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

export class WindowTracker {
    private _extension: any;
    private _windowCreatedId: number;
    private _windowRemovedId: number;
    private _activeWorkspaceChangedId: number;
    private _trackingCallback: (action: string, window: Meta.Window) => void;
    
    constructor(extension: any, callback?: (action: string, window: Meta.Window) => void) {
        this._extension = extension;
        this._trackingCallback = callback || (() => {});
        
        // Connect to window tracking signals
        this._windowCreatedId = global.display.connect('window-created', 
            (_display: any, window: Meta.Window) => this._onWindowCreated(window));
            
        this._windowRemovedId = global.workspace_manager.connect('workspace-removed', 
            (_wm: any, _index: number) => this._onWorkspaceRemoved());
            
        this._activeWorkspaceChangedId = global.workspace_manager.connect('active-workspace-changed',
            () => this._onActiveWorkspaceChanged());
    }
    
    destroy() {
        // Disconnect signals
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = 0;
        }
        
        if (this._windowRemovedId) {
            global.workspace_manager.disconnect(this._windowRemovedId);
            this._windowRemovedId = 0;
        }
        
        if (this._activeWorkspaceChangedId) {
            global.workspace_manager.disconnect(this._activeWorkspaceChangedId);
            this._activeWorkspaceChangedId = 0;
        }
    }
    
    setTrackingCallback(callback: (action: string, window: Meta.Window) => void) {
        this._trackingCallback = callback;
    }
    
    getAllWindows(): Meta.Window[] {
        const windows: Meta.Window[] = [];
        
        // Get all window actors and extract their Meta.Window
        for (const actor of global.get_window_actors()) {
            const window = actor.get_meta_window();
            if (window && this._isInterestingWindow(window)) {
                windows.push(window);
            }
        }
        
        return windows;
    }
    
    getWindowsByPID(pid: number): Meta.Window[] {
        return this.getAllWindows().filter(window => window.get_pid() === pid);
    }
    
    getWindowsByApp(appId: string): Meta.Window[] {
        const tracker = Shell.WindowTracker.get_default();
        
        return this.getAllWindows().filter(window => {
            const app = tracker.get_window_app(window);
            return app && app.get_id() === appId;
        });
    }
    
    private _onWindowCreated(window: Meta.Window) {
        // Skip windows we're not interested in
        if (!this._isInterestingWindow(window)) return;
        
        // Set up window-specific signals
        window.connect('notify::minimized', () => {
            this._onWindowMinimizeChanged(window);
        });
        
        // Notify callback
        this._trackingCallback('created', window);
    }
    
    private _onWindowMinimizeChanged(window: Meta.Window) {
        this._trackingCallback('minimized-changed', window);
    }
    
    private _onWorkspaceRemoved() {
        // Just notify that workspace configuration changed
        this._trackingCallback('workspace-changed', null as unknown as Meta.Window);
    }
    
    private _onActiveWorkspaceChanged() {
        // Just notify that active workspace changed
        this._trackingCallback('active-workspace-changed', null as unknown as Meta.Window);
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
}