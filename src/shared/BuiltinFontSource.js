export default new class BuiltinFontSource {
    _BUILTIN_FONTS = [
        "Arial",
        "Arial Black",
        "Comic Sans MS",
        "Courier New",
        "Georgia",
        "Impact",
        "Lucida Sans Unicode",
        "Lucida Console",
        "Tahoma",
        "Trebuchet MS",
        "Times New Roman",
        "Verdana"
    ];

    GetFontNames() {
        return this._BUILTIN_FONTS;
    }

    LoadFont(fontName) {
        // we never have to load anything, so never return a promise -- always return null
        return null;
    }
}