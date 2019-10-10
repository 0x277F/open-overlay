// Handlers for adding layers to the overlay based on their mime type.
// Used when dropping & pasting.

const DEFAULT_TIMEOUT_MS = 10000;
const YOUTUBE_URL_REGEX = /.*(?:www\.youtube\.com\/(?:(?:watch\?v=)|(?:embed\/))|(?:youtu\.be\/))([a-z0-9]+)(?:\?(?:(?:t)|(?:start))=(\d+))?/i;

let contentTypeHandlers = [
    {   // image
        match: type => type.match(/image/i),
        getLayers: async (url) => {
            // create the image and get its natural dimensions by loading it
            return await new Promise((resolve, reject) => {
                let img = new Image();
                img.addEventListener("load", () => {
                    resolve([{
                        elementName: "image",
                        elementConfig: {
                            width: Math.min(img.naturalWidth, 1920),
                            height: Math.min(img.naturalHeight, 1080),
                            config: {
                                url: url,
                                fit: "cover"
                            }
                        }
                    }]);
                });
                img.src = url;

                // 10 second timeout
                setTimeout(reject, DEFAULT_TIMEOUT_MS);    
            });
        }
    },
    {   // video  
        match: type => type.match(/video/i),
        getLayers: async (url) => {
            return await new Promise((resolve, reject) => {
                // get the video's natural dimensions
                let vid = document.createElement("video");
                vid.addEventListener("loadeddata", () => {
                    resolve([{
                        elementName: "video",
                        elementConfig: {
                            width: Math.min(vid.videoWidth, 1920),
                            height: Math.min(vid.videoHeight, 1080),
                            config: {
                                url: url,
                                fit: "cover"
                            }
                        }
                    }]);
                });
                let source = document.createElement("source");
                source.src = url;
                vid.appendChild(source);
                setTimeout(reject, DEFAULT_TIMEOUT_MS);
            });
        }
    },
    {   // audio
        match: type => type.match(/audio/i),
        getLayers: async (url) => {
            return [{
                elementName: "audio",
                elementConfig: {
                    config: {
                        url: url
                    }
                }
            }];
        }
    },
    {   // youtube
        match: (type, value) => type.match(/text\/html/i) && value.match(YOUTUBE_URL_REGEX),
        getLayers: async (url) => {
            // parse out the start parameter, if there is one
            let match = url.match(/(?:star)?t=(\d+)/i);
            let start = (match && match.length == 2 ? match[1] : null);
            // possibly use the youtube api to pull the ideal height/width?
            return [{
                elementName: "youtube",
                elementConfig: {
                    width: 1280,
                    height: 720,
                    config: {
                        url: url,
                        start: start
                    }
                }
            }];
        }
    },
    {   // iframe (any HTML content type)
        match: type => type.match(/text\/html/i),
        getLayers: async (url) => {
            return [{
                elementName: "iframe",
                elementConfig: {
                    width: 1280,
                    height: 720,
                    config: {
                        url: url
                    }
                }
            }];
        }
    },
    {   // iframe (any HTML content type)
        match: type => type.match(/text\/plain/i),
        getLayers: async (data) => {
            return [];
        }
    },
];

export default contentTypeHandlers;