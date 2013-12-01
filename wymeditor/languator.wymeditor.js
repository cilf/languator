(function ( $ ) {
    WYMeditor.editor.prototype.languator = function(options) {
        var wym = this,
        _doc = $(wym._iframe.contentDocument);

        /**
         * aby to poslouchalo keyup keydown
         */
        $.ln.setElements(_doc);

        $.extend($.ln, {
            /**
             * prepisuje deafultni nastaveni
             */
            options: options,

            /**
             * sezene text, ve kterem potom hleda podle carret pozice slovo
             */
            getElementValue: function () {
                return $(wym.selected()).html();
            },

            /**
             * caret pozice pro vyhledani slova v textu
             */
            getCaretPosition: function () {
                wym.insert('<img id="hl">');

                /**
                 *  rozdeleni textu pro zjisteni aktualne napsaneho slova
                 */
                var parts = $(wym.selected()).html().split(/<img id="?hl"?>/i);
            
                _doc.find('#hl').remove();
            
                return parts.shift().length; //start2carettext
            },

            /**
             * sezene offset cursoru (carretu)
             */
            getHolderPosition: function () {
                wym.insert('<img id="hl">');

                var cursorOffset = _doc.find('#hl').offset(),
                iframeOffset = $(wym._iframe).offset();

                _doc.find('#hl').remove();            
            
                return {
                    top: cursorOffset.top + 15 + iframeOffset.top, 
                    left: cursorOffset.left + iframeOffset.left
                };
            },
        
            /**
             * vklada slovo, umi mazat slovo jenom dozadu
             * textarea umi mazat slovo i dopredu
             */
            _insertWord: function (word) { 
                while ( $.ln.wordSize.left !== 0 ) {
                    wym._exec('Delete');
                    $.ln.wordSize.left--;
                }
                
                wym.insertAtCaret( word );
            }
        });
    };
}( jQuery ));


// Works in most browsers except Internet Explorer
// http://forum.wymeditor.org/forum/viewtopic.php?f=2&t=376
WYMeditor.editor.prototype.insertAtCaret = function (html)
{
    // Do we have a selection?
    if (this._iframe.contentWindow.getSelection().focusNode !== null) {
        // Overwrite selection with provided html
        this._exec('inserthtml', html);
    } else {
        // Fall back to the internal paste function if there's no selection
        this.paste(html);
    }
};

// IE needs some more help
WYMeditor.WymClassExplorer.prototype.insertAtCaret = function (html)
{
    // Get the current selection
    var range = this._doc.selection.createRange();
    // Reference to the iframe
    var iframe = this._iframe;

    // Check if the current selection is inside the editor
    if (jQuery(range.parentElement()).parents('.wym_iframe').is('*')) {
        try {
            // Overwrite selection with provided html
            range.pasteHTML(html);
        } catch (e) { }
    } else {
        // Fall back to the internal paste function if there's no selection
        this.paste(html);
    }
};