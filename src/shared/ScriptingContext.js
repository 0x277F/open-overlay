import { cloneDeep, merge } from "lodash";

// quick reference for scripting functions

// listen for "event-name" on a layer titled "layer 1"
// A: on("event-name", "layer 1", (eventArgs) => { ... })

// listen for "event-name" on any layer
// A: on("event-name", (eventArgs) => { ... })

// set the props on "layer 1" - props are position (top, left, width, height, rotation)
// A: setLayerProps("layer 1", { top: 10 })

// set the config on a layer - config are element-specific fields
// A: setLayerConfig("layer 1", { text: "new text here" })


/* 
// emit a custom event "custom-event"
// A: emit("custom-event", { arg1, arg2 });
// B: self().emit("custom-event", args)
*/

function layerFilterToMatchFunction(layerFilter) {
    if (!layerFilter) { return null; }
    return (typeof layerFilter === "object" ? matchLayerObject : matchLayerLabel);
}

function matchLayerObject(layer, layerFilterObject) {
    for(let [prop, val] of Object.entries(layerFilterObject)) {
        if (layer[prop] != val) { return false; }
    }
    return true;
}

function  matchLayerLabel(layer, layerFilterString)  {
    return (layer.label == layerFilterString);
}

class OverlayContext {

    _eventHandlers;
    _layers;
    _lastUpdated;
    _onUpdated;
    _hasModifiedLayers;
    _maxLayerId;

    get hasModifiedLayers() { return this._hasModifiedLayers };
    get layers() { return this._layers; }
    get lastUpdated() { return this._lastUpdated; }

    constructor(layers, lastUpdated, onUpdated) {
        this._eventHandlers = {};
        this._layers = layers;
        this._lastUpdated = lastUpdated;
        this._onUpdated = onUpdated;
        this._hasModifiedLayers = false;
        
        // get the max layer id
        this._maxLayerId = layers.reduce((a,c) => (c.id > a ? c.id : a), 0);
    }

    emitToOtherLayers = (eventName, eventArgs, sourceLayer) => {

        let handlers = this._eventHandlers[eventName];

        if (!handlers) { return; }

        for(let handler of handlers) {
            
            // if there is a matchFunction/layerFilter supplied, run it for this source layer
            // non-matches get skipped
            if (handler.matchFunction && !handler.matchFunction(sourceLayer, handler.layerFilter)) { continue; }

            // layer filter doesn't exist or matches, so invoke the callback
            handler.callback(eventArgs, sourceLayer);
        }
    }

    // WITH LAYER FILTER: on("event-name", "layer 1", (args) => {})
    // WITHOUT:           on("event-name", (args) => {})
    on = (eventName, layerFilterOrCallback, callback) => {
        // lazy-instantiate handlers
        let handlers = this._eventHandlers[eventName];
        if (!handlers) {
            handlers = [];
            this._eventHandlers[eventName] = handlers;
        }

        // if callback is null, then layerFilterOrCallback contains callback
        // this code is confusing, but efficient.  read carefully :|
        let layerFilter;
        if (!callback)
            callback = layerFilterOrCallback;
        else
            layerFilter = layerFilterOrCallback;

        // immediately convert to a match function for efficiency
        let matchFunction = (layerFilter ? layerFilterToMatchFunction(layerFilter) : null);

        handlers.push({ matchFunction, layerFilter, callback });
    }

    setLayer = (layerFilter, callbackFnOrObject) => {

        // allow layerFilter to be not provided
        if (!callbackFnOrObject) {
            callbackFnOrObject = layerFilter;
            layerFilter = null;
        }

        // determine our layer match function
        let matchFunction = layerFilterToMatchFunction(layerFilter);

        // find out if our parameter is a callback or a function
        let isCallback = (typeof callbackFnOrObject === "function" ? true : false);

        // iterate
        for(let i = 0; i < this._layers.length; i++) {
            
            // skip layers that don't match
            if (matchFunction && !matchFunction(this._layers[i], layerFilter)) { continue; }

            let result = (isCallback ? callbackFnOrObject(this._layers[i]) : callbackFnOrObject);
            
            // apply the changes to the layer if we had a return value
            if (result) {
                // deep clone the layer
                let layer = cloneDeep(this._layers[i]);

                // merge the result props using lodash/merge
                merge(layer, result);

                // assign back to the array
                this._layers[i] = layer;

                this._hasModifiedLayers = true;
            }
        }
    }

    cloneLayer = (layerFilter) => {
        // layerFilter must be provided
        if (!layerFilter) { return null; }

        // get match function
        let matchFunction = layerFilterToMatchFunction(layerFilter);

        // find the first layer that matches
        let targetLayer;
        for(let layer of this._layers) {
            if (matchFunction(layer, layerFilter)) {
                targetLayer = layer;
                break;
            }
        }

        // return null if no layer matches
        if (!targetLayer) { return null; }

        // clone the layer
        let clonedLayer = cloneDeep(targetLayer);

        // and delete id since this will be autogenerated when added back
        delete clonedLayer.id;

        return clonedLayer;
    }

    addLayer = (layer) => {
        layer.id = ++this._maxLayerId;
        this._hasModifiedLayers = true;
        this._layers.push(layer);        
    }

    removeLayer = (layerFilter) => {
        // layerFilter must be provided
        if (!layerFilter) { return null; }

        // get match function
        let matchFunction = layerFilterToMatchFunction(layerFilter);

        let layersToRemove = [];
        let targetLayer;
        for(let layer of this._layers) {
            if (matchFunction(layer, layerFilter)) {
                layersToRemove.push(layer);
            }
        }

        for(let layer of layersToRemove) {
            this._layers.splice(this._layers.indexOf(layer), 1);
        }

        this._hasModifiedLayers = true;

        return layersToRemove;
    }

    update = () => {
        this._onUpdated();
    }

}

// NEW METHOD
/*
overlay.on("event-name")
overlay.setLayer("Layer Name", { top: 10 });
overlay.setLayer("Whatever", { top: 20 });
let clone = overlay.cloneLayer("Layer Name");
overlay.addLayer(clone);
overlay.removeLayer("Layer Name");
overlay.update();
*/

export default class ScriptingContext {

    _onUpdated;
    _overlayContext;
    _lastExecutionError;
    _interceptedTimeouts = [];
    _interceptedIntervals = [];

    get lastExecutionError() { return this._lastExecutionError; }
    get hasModifiedLayers() { return (this._overlayContext && this._overlayContext.hasModifiedLayers); }
    get layers() { return (!this._overlayContext ? [] : this._overlayContext.layers); }

    constructor(opts) {
        this._onUpdated = opts.onUpdated;
    }

    emitToOtherLayers = (eventName, eventArgs, sourceLayer) => {
        // don't emit if we don't have an overlay context
        if (!this._overlayContext) { return; }

        this._overlayContext.emitToOtherLayers(eventName, eventArgs, sourceLayer);
    }

    reset = () => {
        // clear all timeouts
        for(let timeout of this._interceptedTimeouts) { clearTimeout(timeout); }
        this._interceptedTimeouts = [];

        // clear all intervals
        for(let interval of this._interceptedIntervals) { clearInterval(interval); }
        this._interceptedIntervals = [];

        // clear out overlay context
        this._overlayContext = null;
    }

    validateScript = (script) => {
        try {
            window.Function(`return function() { ${script} }`)();
            return null;
        }
        catch (ex) {
            return ex;
        }
    }

    setTimeoutOverride = (callback, delay) => {
        let timeout = setTimeout(callback, delay);
        this._interceptedTimeouts.push(timeout);
        return timeout;
    }

    setIntervalOverride = (callback, period) => {
        let interval = setInterval(callback, period);
        this._interceptedIntervals.push(interval);
        return interval;
    }

    execute = (layers, script, lastUpdated) => {

        this._overlayContext = new OverlayContext(layers, lastUpdated, this._onUpdated);

        try
        {
            this._lastExecutionError = null;

            window.Function(`return function(overlay, setTimeout, setInterval) { ${script} }`)()(
                this._overlayContext,
                this.setTimeoutOverride,
                this.setIntervalOverride
            );

            return true;
        }
        catch (ex) {
            this._lastExecutionError = ex;
            return false;
        }
    }
};