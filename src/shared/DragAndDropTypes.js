export const DragAndDropTypes = {
    LAYER: "overlayjs/layer",
    EventHasType: function(evt, type) {
        if (!evt.dataTransfer.types || evt.dataTransfer.types.length == 0) { return false; }
        return evt.dataTransfer.types.includes(type);
    }
};