
(function ( $, window ) {

    $.fn.languator = function(options) {

        if ($.isFunction($.fn.getSelection) === false) {
            alert('you have to include jquery.a-tools plugin for languator');
        }

        var HELPER_ID = 'helper';
        
        $.ln.setElements(this);
        
        $.extend($.ln, {
            /**
             * prepisuje defaultni nastaveni
             */
            options: options,

            _insertWord: function (word) {
                var $el = $.ln.getActiveElement();
                

                /**
                 * pokud nahrazazuju uz kousek napsaneho slova
                 */
                if ($.ln.wordSize.left || $.ln.wordSize.right) {
                    var cp = $.ln.getCaretPosition(); // caret position
                    $el
                    .setSelection(cp - $.ln.wordSize.left, cp + $.ln.wordSize.right)
                    .replaceSelection(word);
                } else {
                    $el.insertAtCaretPos(word);
                }

                $.ln.wordSize.left = $.ln.wordSize.right = 0;
            },
            
            getCaretPosition: function () {
                return $.ln.getActiveElement().getSelection().start;
            },
            
            getElementValue: function () {
                return $.ln.getActiveElement().val();
            }
        });
        
        /**
         * pro IE existuje jednodussi zpusob nalezeni offsetu caretu
         *  - range obsahuje pri offset
         */
        
        var winsel = window.document.selection;
        if ($.type(winsel) === 'object' && $.isFunction(winsel.createRange)) {
            $.extend($.ln, {
                getHolderPosition: function () {
                    var $area = $.ln.getActiveElement(),
                    lineHeight = parseInt($area.css('font-size'), 10),
                    range = winsel.createRange();

                    return {
                        top: range.offsetTop + lineHeight,
                        left: range.offsetLeft
                    };
                }
            });
        /**
         * pro ostatni browsery vkladam obsah textarey do pomocneho divu
         * a do nej vlozim <span>, ktery potom mi udava pozici caretu
         */
        } else {
            $.extend($.ln, {
                getHolderPosition: function () {
                    var $area = $.ln.getActiveElement(),
                    pos = $.ln.getCaretPosition();

                    $area.setSelection(0, pos);
                    var text = $area.getSelection().text;

                    $area.setSelection(pos, pos);

                    text = text.replace(/\n|\t/g, '<br />');
                    text = text.replace(/ {2}/g, '&nbsp;&nbsp;'); //dve mezery vedle sebe nahrad nezalomitelnejma, v divu se dve mezery vedle sebe nedaj pouzit
                    text = text.replace(/ $/g, '&nbsp;'); //posledni mezeru nahrazuju nezlomitelnou, kdyz bych to neudelal, tak by se span vlozeny za touto mezerou vlozil na druhy radek a nedal by mi spravnou pozici

                    var $h = $('#' + HELPER_ID);
                    $h.width($area[0].clientWidth)//prenastavuje vysku / sirku pomocneho divu, pri kazdem stisknuti klavesy (textarea muze mit nove scrollbar)
                    .height($area[0].clientHeight);
                    $h.html(text + '<span></span>');
                    
                    var offset = $h.find('span').offset(),
                    lineHeight = parseInt($area.css('font-size'), 10);

                    if (!offset) {
                        return {};
                    }

                    return {
                        top: offset.top + lineHeight - $area.scrollTop(), 
                        left: offset.left - $area.scrollLeft()
                    };
                }
            });
            
            this.each(function () {
                $(this).bind({
                    focus: function () {
                        if($('#' + HELPER_ID).length){
                            return;
                        }
                        var $area = $(this);
                        $('<div/>', {
                            id: HELPER_ID,
                            css: {
                                position: 'absolute',
                                top: $area.offset().top,
                                left: $area.offset().left,
                                'z-index': -1,
                                'visibility': 'hidden',
                                'font-family': $area.css('font-family'),
                                'padding': $area.css('padding'),
                                'font-size': $area.css('font-size'),
                                'line-height': $area.css('line-height'),
                                'word-wrap': 'break-word'
                            }
                        }).insertAfter($area);
                    },
                    blur: function () {
                        $('#' + HELPER_ID).remove();
                    }
                });
            });
        }
        return this;
    };
}( jQuery, window ));

