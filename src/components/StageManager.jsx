import React from "react";
import ZoomSelector from "./ZoomSelector.jsx";
import BackgroundSelector from "./BackgroundSelector.jsx";
import Resizer from "./Resizer.jsx";
import Dispatcher from "../shared/dispatcher.js";
import "./StageManager.css";

export default class StageManager extends React.Component {
    
    static RESIZE_HANDLE_SIZE = 10;
    
    _stageContainerRef;
    _zoomContainerRef;

    _bodyDrag;

    constructor(props) {
        super(props);
        // props.stageWidth
        // props.stageHeight
        // props.layers
        // props.selectedLayerIds
        // props.onSelectedLayerIdChanged
        // props.onSelectedLayerRectChanged

        this._stageContainerRef = React.createRef();
        this._zoomContainerRef = React.createRef();

        this.state = {
            zoom: ZoomSelector.ZOOM_AUTOFIT_VALUE,
            autoFitZoom: 1,
            panning: { x: 0, y: 0 },
            backgroundImage: null
        };
    }

    componentDidMount() {
        this._stageContainerRef.current.addEventListener("wheel", this.onWheel);
        this._stageContainerRef.current.addEventListener("mousedown", this.onMouseDown);
        this._stageContainerRef.current.addEventListener("contextmenu", this.onContextMenu);
        document.body.addEventListener("mouseup", this.onBodyMouseUp);
        document.body.addEventListener("mousemove", this.onBodyMouseMove);
        document.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("resize", this.onWindowResized);

        // don't pass mousedowns further down the DOM
        this._zoomContainerRef.current.addEventListener("mousedown", evt => { evt.stopPropagation(); });

        this.updateAutoFit();
    }

    onWheel = evt => {
        let steps = (-evt.deltaY / 100);
        let zoom = this.getZoomValue();
        zoom = (steps < 0 ? zoom / (1 + (-steps * 0.1)) : zoom * (1 + (steps * 0.1)));
        this.onZoomChanged(zoom);
    }

    onKeyDown = evt => {
        if (evt.key == "0" && evt.ctrlKey) {
            this.onZoomChanged(ZoomSelector.ZOOM_AUTOFIT_VALUE);
        }
    }

    onContextMenu = evt => {
        evt.stopPropagation();
        evt.preventDefault();
    }

    onMouseDown = evt => {

        // if the target is a layer container, select it
        let layerContainer = evt.target.closest(".layer-container");
        if (layerContainer) {
            let id = parseInt(layerContainer.getAttribute("data-id"));
            Dispatcher.Dispatch("SELECT_LAYER", id);
            return;
        }

        if ((evt.buttons & 2) != 2) {
            return;
        }

        // otherwise, start a body drag
        this._bodyDrag = {
            sourceX: evt.clientX,
            sourceY: evt.clientY,
            basePanning: Object.assign({}, this.state.panning)
        };
    }

    onBodyMouseUp = evt => {
        if (this._bodyDrag) {
            this._bodyDrag = null;
        }
    }

    onBodyMouseMove = evt => {
        if (this._bodyDrag) {
            let zoom = this.getZoomValue();
            this.setPanning(
                this._bodyDrag.basePanning.x + ((evt.clientX - this._bodyDrag.sourceX) / zoom),
                this._bodyDrag.basePanning.y + ((evt.clientY - this._bodyDrag.sourceY) / zoom)
            );
        }
    }

    onWindowResized = evt => {
        this.updateAutoFit();
    }

    updateAutoFit = () => {
        // calculate auto-fit
        if (this._stageContainerRef.current) {
            let rect = this._stageContainerRef.current.getBoundingClientRect();
            if (rect.height > 0 && rect.width > 0) {
                let ratio = this.props.stageHeight / this.props.stageWidth;
                let scale;
                if (rect.height / rect.width < ratio)
                    scale = rect.height / this.props.stageHeight;
                else
                    scale = rect.width / this.props.stageWidth;

                if (this.state.autoFitZoom != scale) {
                    this.setState({ autoFitZoom: scale });
                }
            }
        }
    }

    onZoomChanged = zoom => {
        this.setState(prevState => {
            return {
                zoom: zoom,
                panning: (zoom == ZoomSelector.ZOOM_AUTOFIT_VALUE ? { x: 0, y: 0 } : prevState.panning)
            };
        });
    }

    setPanning = (x, y) => {
        this.setState({
            panning: { x: x, y: y}
        });
    }

    getZoomValue() {
        return (this.state.zoom == ZoomSelector.ZOOM_AUTOFIT_VALUE ? this.state.autoFitZoom : this.state.zoom);
    }

    onSelectedRectChanged = (layerId, rect, createUndo) => {
        Dispatcher.Dispatch("UPDATE_LAYER_CONFIG", layerId, rect, createUndo);
    }

    onSetResizeCursor = cursor => {
        this._stageContainerRef.current.style.cursor = cursor;
    }

    onSelectAtCoords = (x, y, right, bottom, multiSelect) => {
        if (right == x || bottom == y) {
            // if this is a point select, pick all the layers that contain the point
            let possibleLayers = this.props.layers.filter(layer => {
                let element = this.props.elements[layer.elementName];
                return (element &&
                    !element.manifest.nonVisual &&
                    y > layer.top &&
                    x > layer.left &&
                    y < (layer.top + layer.height) &&
                    x < (layer.left + layer.width));
            });

            if (possibleLayers.length == 0) {
                Dispatcher.Dispatch("SELECT_LAYER", null);
                return;
            }
            
            if (this.props.selectedLayerIds.length == 0) {
                Dispatcher.Dispatch("SELECT_LAYER", possibleLayers[0].id, multiSelect);
                return;
            }
    
            if (possibleLayers.length == 1 || multiSelect) {
                Dispatcher.Dispatch("SELECT_LAYER", possibleLayers[0].id, multiSelect);
                return;
            }
    
            // only when NOT multiSelecting
            let index = possibleLayers.findIndex(r => this.props.selectedLayerIds.includes(r.id));
            if (index == -1) {
                Dispatcher.Dispatch("SELECT_LAYER", possibleLayers[0].id, multiSelect);
                return;
            }
    
            index = (index + 1) % possibleLayers.length;
            Dispatcher.Dispatch("SELECT_LAYER", possibleLayers[index].id, multiSelect);
        } else {
            // if this a box select, pick all the layers that fall inside the box
            let possibleLayers = this.props.layers.filter(layer => {
                let element = this.props.elements[layer.elementName];
                return (element &&
                    !element.manifest.nonVisual &&
                    y < layer.top &&
                    x < layer.left &&
                    bottom > (layer.top + layer.height) &&
                    right > (layer.left + layer.width));
            });

            // if not multi-selecting, deselect everything first
            if (!multiSelect)
            Dispatcher.Dispatch("SELECT_LAYER", null, false);

            for(let layer of possibleLayers) {
                Dispatcher.Dispatch("SELECT_LAYER", layer.id, true);
            }
        }
    }

    onBackgroundImageChanged = (backgroundImage) => {
        this.setState({ backgroundImage });
    }

    render() {

        let preserveAspect = true;
        let selectedRects = [];
        for(let id of this.props.selectedLayerIds) {
            let layer = this.props.layers.find(r => r.id == id);
            if (!layer) { continue; }
            let element = this.props.elements[layer.elementName];
            if (element.manifest.nonVisual) { continue; } // skip non-visual elements
            if (!element.manifest.preserveAspect && preserveAspect) { preserveAspect = false; } // preserve aspect only when ALL selected elements preserve aspect
            selectedRects.push({
                id: id,
                top: layer.top,
                left: layer.left,
                height: layer.height,
                width: layer.width,
                right: layer.left + layer.width,
                bottom: layer.top + layer.height,
                rotation: layer.rotation
            });
        }

        let boundingBox = null;
        for(let rect of selectedRects) {
            if (!boundingBox) { boundingBox = {}; }
            if (boundingBox.top == null || boundingBox.top > rect.top) { boundingBox.top = rect.top; }
            if (boundingBox.left == null || boundingBox.left > rect.left) { boundingBox.left = rect.left; }
            if (boundingBox.right == null || boundingBox.right < rect.right) { boundingBox.right = rect.right; }
            if (boundingBox.bottom == null || boundingBox.bottom < rect.bottom) { boundingBox.bottom = rect.bottom; }
        }
        if (boundingBox) {
            // convert right/bottom to width/height
            boundingBox.width = boundingBox.right - boundingBox.left;
            boundingBox.height = boundingBox.bottom - boundingBox.top;
        }

        let backgroundImageUrl;
        if (this.props.backgroundImages && this.state.backgroundImage)
            backgroundImageUrl = this.props.backgroundImages[this.state.backgroundImage];

        let zoomValue = this.getZoomValue();
        let stageStyle = {
            width: this.props.stageWidth + "px",
            height: this.props.stageHeight + "px",
            transform: `scale(${zoomValue}) translate(${this.state.panning.x}px, ${this.state.panning.y}px)`,
            backgroundImage: (backgroundImageUrl ? `url(${backgroundImageUrl})` : null)
        };

        return (
            <div className="stage-container" ref={this._stageContainerRef}>
                <div className="stage-view-container" ref={this._zoomContainerRef}>
                    <ZoomSelector zoom={this.state.zoom} autoFitZoom={this.state.autoFitZoom} onZoomChanged={this.onZoomChanged} />
                    <BackgroundSelector backgroundImages={this.props.backgroundImages} backgroundImage={this.state.backgroundImage} onBackgroundImageChanged={this.onBackgroundImageChanged} />
                </div>
                <div className="stage" style={stageStyle}>
                    {this.props.children}
                </div>
                {this.props.hideResizer ? null : (
                    <Resizer handleSize={10}
                        boundingBox={boundingBox}
                        selectedRects={selectedRects}
                        stageWidth={this.props.stageWidth}
                        stageHeight={this.props.stageHeight}
                        preserveAspect={preserveAspect}
                        zoom={zoomValue}
                        panning={this.state.panning}
                        onSelectedRectChanged={this.onSelectedRectChanged}
                        onSetCursor={this.onSetResizeCursor}
                        onSelectAtCoords={this.onSelectAtCoords} />
                )}
            </div>
        );
    }
}
