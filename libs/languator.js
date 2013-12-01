/**
 * Languator plugin
 * registers its instance into $.ln
 * May 25, 2011
 * @author Marek Polcar, polcama1@fel.cvut.cz
 */

(function ( $ ) {

    var FALSE = false,
    TRUE = true,
    NULL = null,
    UNDEFINED = 'undefined',
    ARRAY = 'array',
    OBJECT = 'object',
    TOOL = 'tool';
        
    $.widget('ui.holder', $.ui.menu, {
        widgetEventPrefix: 'holder',
        options: {
            position: {
                my: 'left top',
                at: 'right top',
                collision: 'fit flip'
            },
            
            select: function(e, ui) {
                e.preventDefault();
                var tool = $(ui.item).data(TOOL);
                if (tool && $.isFunction(tool.select)) {
                    tool.select(e, ui);
                    $.ln.clearBlurElementTimer();
                }
            }
        },
        /**
         * pokud se z toolu vrati FALSE
         *  - neotevre dalsi level menu
         *  - neschova se holder pri sipce doprava
         */
        focus: function(e, item) {
            var tool = $(item).data(TOOL);
            if (tool && $.isFunction(tool.focus)) {
                if( tool.focus(e) === FALSE ) {
                    /**
                     * menu kontroluje /^mouse/.test(event.type), jestli ma otevrit submenu
                     * proto mu nastavim neco jinyho, aby to nematchnul a nic neotevrel
                     */
                    e.type = 'key';
                }
            }
            this._super('focus', e, item);
        },
        right: function (e) {
            var tool = $(this.active).data(TOOL);
            if (tool && $.isFunction(tool.focus)) {
                if( tool.focus(e) === FALSE ) {
                    return;
                }
            }
            this._shouldHide( this._super('right', e) );
        },
        left: function (e) {
            this._shouldHide( this._super('left', e) );
        },
        _create: function () {
            this.element.find('ul').andSelf().addClass('languator-holder');
            this._super('_create');
        },
        _shouldHide: function (result) {
            if ($.type(result) === UNDEFINED) {
                $.ln.hideHolder();
            }
        }
    });

    
    $.ln = {
        /**
         * defaults
         */
        options: {
            /**
             * true - neustale naseptava
             * false - naseptava pouze po stisknuti CTRL + SPACE
             */
            autoShow: TRUE,
            
            /**
             * TRUE ~ nastavi holderu vyssi z-index aby byl videt pres infobox
             */
            holderOverInfoBox: FALSE,
            
            apiUrl: '/api/',

            /**
             * 5ms nesmi byt stisknuta klavesa aby se poslal pozadavek na server
             *  - abych neposilal zbytecne pozadavavky pri psani
             */
            keyPressDelay: 5,
            
            /**
             * ~ event[controlKey]
             * altKey | ctrlKey | shiftKey
             */
            controlKey: 'ctrlKey',
            
            infoDivClass: 'languator-info',
            
            /**
             * pokud neni definovana metoda getHolderPosition, tak se pouzijou tyhle souradnice
             */
            defaultHolderPosition: {
                top: 0, 
                left: 0
            },
            
            /**
             * default infobox position
             */
            infoPosition: 'right bottom',

            /**
             * default infobox size
             */
            infoSize: {
                width: 600, 
                height: 400
            },
            
            cookiePrefix: 'languator-',
            
            suggestKey: $.ui.keyCode.SPACE,
            toolKey: $.ui.keyCode.PERIOD
        },
        
        init: function () {
            if ($.isFunction($.fn.scrollTo) === FALSE) {
                $.ln.log('you haven\'t included jQuery.ScrollTo plugin - you won\'t be able to scroll infobox with keys');
                $.ln.useScrollTo = FALSE;
            }
            if ($.isFunction($.toJSON) === FALSE) {
                $.ln.log('you haven\'t included jquery.json-2.2.min plugin - position of infobox won\'t be remembered');
                $.ln.useCookie = FALSE;
            }
            if ($.isFunction($.cookie) === FALSE) {
                $.ln.log('you haven\'t included  Cookie plugin - position of infobox won\'t be remembered');
                $.ln.useCookie = FALSE;
            }
        },

        /**
         * loguje chybove hlasky, napr o chybejicich pluginech
         */
        log: function (str) {
            $('<p>', {
                text: str
            }).prependTo('body');
        },

        /**
         * obsahuje aktivni element (napr textareu)
         * jinak false
         */
        focusedElement: FALSE,

        getActiveElement: function () {
            if ($.ln.focusedElement === FALSE) {
                throw new Error('there is no active element');
            }

            return $($.ln.focusedElement);
        },

        clearBlurElementTimer: function () {
            clearTimeout($.ln.blurElementTimer);
        },

        setElements: function ($el) {
            if ($el instanceof $ === FALSE) {
                throw new Error('only jquery objects can be passed in argument');
            }
            
            var passEventOn = [$.ui.keyCode.DOWN, $.ui.keyCode.UP, $.ui.keyCode.TAB, $.ui.keyCode.ENTER, $.ui.keyCode.ESCAPE, $.ui.keyCode.LEFT, $.ui.keyCode.RIGHT];
            
            $el.bind({
                focus: function () {
                    $.ln.focusedElement = this;
                    $.ln.clearBlurElementTimer();
                /**
                     * pri bluru textarey chci aby zmizel holder
                     * kdyz kliknu do holderu, tak je blur() fired driv nez click()
                     * holder pri bluru je tedy zpozden o 500ms a pokud v te dobe je zavolana fce selectItem, tak se blur vyrusi
                     */
                },
                
                blur: function (e) {
                    $.ln.blurElementTimer = setTimeout(function(){
                        $.ln.hideHolder();
                    }, 500);
                },
                
                click: function (e) {
                    if (e[$.ln.options.controlKey]) {
                        $.ln.keyPressed(TRUE);
                    } else {
                        $.ln.hideHolder();
                    }
                },

                keydown: function (e) {

                    /**
                     * ESCAPE zavira holder, pokud je otevreny
                     */
                    if ($.ln.infoIsOpen && e.which === $.ui.keyCode.ESCAPE) {
                        $.ln.hideInfo();
                        return;
                    }
                    
                    /**
                     * CTRL + SPACE vyvola nabidku slov
                     */
                    if (e.which === $.ln.options.suggestKey && e[$.ln.options.controlKey]) {
                        $.ln.keyPressed(TRUE);
                        e.preventDefault();
                    }

                    /**
                     * CTRL + UP | DOWN skroluje infoboxem
                     */
                    if ($.ln.infoIsOpen && e[$.ln.options.controlKey]) {
                        var direction;
                        switch (e.which) {
                            case $.ui.keyCode.DOWN:
                                direction = 'down';
                                break;
                            case $.ui.keyCode.UP:
                                direction = 'up';
                                break;
                            case $.ui.keyCode.PAGE_DOWN:
                                direction = 'pagedown';
                                break;
                            case $.ui.keyCode.PAGE_UP:
                                direction = 'pageup';
                                break;
                            case $.ui.keyCode.LEFT:
                                direction = 'left';
                                break;
                            case $.ui.keyCode.RIGHT:
                                direction = 'right';
                                break;
                        }
                        if (direction) {
                            $.ln.scrollInfo(direction);
                            e.preventDefault();
                            return;
                        }
                        
                    }
                    
                    /**
                     * CTRL + . vyvola nabidku dalsich akci (synonyma, odvozena slova)
                     */
                    if (e.which === $.ln.options.toolKey && e[$.ln.options.controlKey]) {
                        $.ln.showTools();
                        e.preventDefault();
                    }

                    if ($.ln.holder) {

                        /**
                         * posilam udalost do menu
                         */
                        if ($.inArray(e.which, passEventOn) !== -1) {
                            
                            /**
                             * menu plugin vklada jenom enterem
                             * a ja chci vkladat i tabem
                             */
                            if (e.which === $.ui.keyCode.TAB) {
                                e.keyCode = $.ui.keyCode.ENTER;
                            } else {
                                e.keyCode = e.which; //menu plugin kontroluje e.keyCode
                            }
                            
                            /**
                             * pokud je otevrene info okno, chci enterem a tabem vlozit aktivni slovo
                             */
                            if ($.ln.infoIsOpen && e.keyCode === $.ui.keyCode.ENTER && $.ln.getInfoContent().find('.active-word').length > 0) {
                                var word = $.ln.getInfoContent().find('.active-word').text();
                                $.ln.insertWord(word);
                            } else {
                                $.ln.holder.trigger(e);
                            }
                            
                            e.preventDefault();
                        }
                    }

                    /**
                     * zmacknuto pismenko s funkcni klavesou
                     * ulozim pro pozdejsi kontrolu v keyup
                     */
                    if ((e.which === $.ln.options.suggestKey || (e.which < 91 && e.which > 47)) && (e.ctrlKey || e.altKey || e.shiftKey)) {
                        $.ln.dontPressKey.push(e.which);
                    }
                },
                
                keyup: function (e) {
                    
                    if (e.ctrlKey || e.shiftKey || e.altKey || $.inArray(e.which, [$.ui.keyCode.ALT, $.ui.keyCode.CONTROL, $.ui.keyCode.SHIFT].concat($.ln.dontPressKey)) !== -1) {
                        /**
                         * zaroven jsem mel ulozeny pismenko, na kterym jsem nechtel delat keypress
                         * muzu zrusit
                         */
                        if ($.inArray(e.which, $.ln.dontPressKey) !== -1) {
                            $.ln.dontPressKey = [];
                        }
                        /**
                         * schova holder pro ? .  - tedy vsechno ostatni pri stiskle fci klavese(ctrl,alt,shift) krome v kombinaci s . nebo ' '
                         */
                        if ($.ln.holder) {
                            if ($.inArray(e.which, passEventOn.concat([$.ln.options.toolKey, $.ln.options.suggestKey, $.ui.keyCode.CONTROL, $.ui.keyCode.ALT, $.ui.keyCode.SHIFT])) === -1) {
                                $.ln.hideHolder();
                            }
                        }
                        return;
                    }

                    /**
                     * keyup fired na tlacitku, ktere jeste nebylo zruseno a je v poli dontPressKey
                     * -> bylo zmacknuto s ctrl nebo shift nebo alt -> nechci aby byla volana fce keyPressed
                     */
                    if ($.inArray(e.which, $.ln.dontPressKey) !== -1) {
                        $.ln.dontPressKey = [];
                        return;
                    }

                    // non letters schovaj holder
                    if (e.which > 90 || e.which < 48) {
                        if ($.ln.holder) {
                            if ($.inArray(e.which, passEventOn) === -1) {
                                $.ln.hideHolder();
                            }
                        }
                        return;
                    }
                    
                    $.ln.keyPressed(FALSE);
                }
            });
        },

        /**
         * pokud bylo pismenko zmacknuto s ctrl nebo alt nebo shift, tak se pri keydown ulozi sem
         * abych mohl pri keyup kontrolovat pritomnost v tomto poli.
         * pokud tu je, nemuzu v keyup volat fci keyPress, protoze nejspis bylo zmacknuto neco jako ctrl + a
         */
        dontPressKey: [],

        scrollInfo: function (direction) {
            if (direction === 'left' || direction === 'right') {
                $.ln.scrollInfoX(direction);
            } else {
                $.ln.scrollInfoY(direction);
            }
        },

        scrollInfoX: function (direction) {
            var $div = $.ln.getInfoContent(),
            isActiveSynset = $div.find('.active-synset').length > 0,
            activeSynset = isActiveSynset ? $div.find('.active-synset') : $div.find('.synonym:first'),
            words = activeSynset.find('.word'),
            activeWord = words.filter('.active-word').length ? words.filter('.active-word') : words.last(),
            index = words.index(activeWord[0]),
            next = $(words[ direction === 'right' ? ++index : isActiveSynset ? --index : index ]);
            
            /**
             * neni oznaceny zadny synset jako aktivni, oznacim jako aktivni prvni
             */
            if (isActiveSynset === FALSE) {
                $div.find('.synonym:first').addClass('active-synset');
            }
            
            /**
             * skrolovani pres okraj, podle smeru se nastavi bud prvni nebo posledni
             */
            if (next.length === 0) {
                next = words[direction === 'right' ? 'first' : 'last']();
            }
            
            words.removeClass('active-word');
            next.addClass('active-word');
        },

       scrollInfoY: function (direction) {
            if ($.ln.useScrollTo === FALSE) {
                return;
            }
            
            var $div = $.ln.getInfoContent(),
            synonyms = $div.find('.synonym:has(.word), .derivedWord'),
            active = $div.find('.active-synset').length ? $div.find('.active-synset') : $div.find('.synonym, .derivedWord').first(),
            index = synonyms.index(active[0]),            
            next;
            
            switch (direction) {
                case 'down':
                    next = $(synonyms[ index + 1 ]);
                    break;
                case 'up':
                    next = $(synonyms[ index - 1 ]);
                    break;
                case 'pagedown':
                    next = synonyms.filter(function () {
                        return $(this).position().top < $div.height();
                    }).last();
                    break;
                case 'pageup':
                    next = synonyms.filter(function () {
                        return $(this).position().top > 0;
                    }).first();
                    break;
            }
            
            /**
             * skrolovani pres okraj, podle smeru se nastavi bud prvni nebo posledni
             */
            if (next.length === 0) {
                next = synonyms[direction === 'down' ? 'first' : 'last']();
            }
            
            synonyms.removeClass('active-synset');
            
            $div.find('.active-word').removeClass('active-word');
            
            next.addClass('active-synset');
            var activeWord = next.find('.word:first').addClass('active-word');
            /**
             * v odvozenych slovech muze byt "next" samotne odvozene slovo
             */
            if (activeWord.length === 0) {
                next.addClass('active-word');
            }
            
            if (next.length) {
                $div.scrollTo( next, 0, {offset:- ($div.height() / 2)} );
            }
        },

        getInfoContent: function () {
            return $('.' + $.ln.options.infoDivClass).find('div.ui-dialog-content');
        },

        insertWord: function (word) {
            
            $.ln.hideHolder();
            $.ln.hideInfo();
            
            if ($.isFunction($.ln._insertWord) === FALSE) {
                throw new Error('$.ln.insertWord function was not specified');
            }
            
            $.ln._insertWord(word);
            /**
             * pokud pisu na konci textu, toto se nastavi na true
             * pri zvoleni naseptaneho slova se za nej automaticky vlozi mezera
             */
            if ($.ln.lastWrittenWord) {
                $.ln._insertWord(' ');
            }
        },

        hideHolder: function () {
            if ($.ln.holder) {
                $.ln.holder.remove();
            }
            $.ln.holder = NULL;
        },

        makeHolderRekurze: function (items) {
            var $holder = $('<ul></ul>');
            
            items.sort(function(a,b){
                var ao = $.isFunction(a.order) ? a.order() : a.order || Number.MAX_VALUE,
                bo = $.isFunction(b.order) ? b.order() : b.order || Number.MAX_VALUE,
                res = ao - bo;
                
                /**
                 * stupid bug in chrome, item in the middle is pushed to the first position :(
                 * this workaround pushes it to the last position
                 * @see http://code.google.com/p/chromium/issues/detail?id=83055
                 */
                if ($.browser.safari === TRUE) {
                    res = ao > bo ? 1 : -1;
                }
                
                return res;
            });
            
            $.each(items, function(i, item){
                
                if ( ! item) {
                    return TRUE;
                }
                
                var $li = $('<li>').data(TOOL, item);
                
                var $a = $('<a>', {
                    href: '#',
                    text: $.isFunction(item.label) ? item.label() : item.label || item
                });

                var icon = $.isFunction(item.icon) ? item.icon() : item.icon || NULL;
                if (icon) {
                    $('<span></span>', {
                        'class': 'ui-menu-icon ui-icon ' + icon
                    }).appendTo($a);     
                }
                
                var subtitle = $.isFunction(item.subtitle) ? item.subtitle() : item.subtitle || NULL;
                if (subtitle) {
                    $('<span></span>', {
                        'class': 'subtitle',
                        text: subtitle
                    }).appendTo($a);
                }
                
                $a.appendTo($li);
                $li.appendTo($holder);
            
                var assignSynonyms = $.isFunction(item.assignSynonyms) ? item.assignSynonyms() : item.assignSynonyms || NULL;
                if (assignSynonyms) {
                    $.ln.assignSynonymsIcon($li);
                }
            
                if ($.isFunction(item.children)) {
                    item.children = item.children();
                }
                
                if ($.type(item.children) === ARRAY && item.children.length) {
                    $.ln.makeHolderRekurze(item.children).appendTo($li);
                }
            });
            
            return $holder;
        },

        assignSynonymsIcon: function (li) {
            var item = li.data(TOOL);
            if ( ! item) {
                return;
            }
            
            // item.word || item.label || NULL;
            var word = $.isFunction(item.word) ? item.word() : ( item.word ? item.word : $.isFunction(item.label) ? item.label() : item.label ) || NULL;
            if ( ! word) {
                return;
            }
            $.ln.fetchRemote('synonyms', word).then(function(response){
                if (response.synonyms.length > 0) {
                    $('<span></span>', {
                        'class': 'ui-menu-icon ui-icon ui-icon-newwin'
                    }).prependTo(li.find('a:first'));
                }
            });
        },

        bringHolderToFront: function () {
            if ($.ln.holder && $.ln.infoIsOpen && $.ln.options.holderOverInfoBox) {
                $.ln.holder.css('z-index', $('.' + $.ln.options.infoDivClass).css('z-index') + 1);
            }
        },

        fillHolder: function (items) {
            $.ln.hideHolder();
            
            var position = $.isFunction( $.ln.getHolderPosition ) ? $.ln.getHolderPosition() : $.ln.options.defaultHolderPosition;
           
            $.ln.holder = $.ln.makeHolderRekurze(items);
            $.ln.holder
            .css({
                top: position.top,
                left: position.left
            })
            .appendTo('body')
            .holder()
            .trigger($.Event('keydown', {
                keyCode: $.ui.keyCode.DOWN
            })); //* oznaci prvni polozku v menu jako aktivni
            
            $.ln.getActiveElement().trigger('onFillHolder');
            
            $.ln.bringHolderToFront();
        },
        
        /**
         * vytvori sliby pro tools menu
         */
        fetchToolsPromises: function (word) {
            var promises = [];
            
            $.each($.ln.tools, function (name, tool) {
                
                if ($.isFunction(tool.fetchData) === FALSE) {
                    return TRUE;
                }
                    
                var promise = $.Deferred(function( dfd ){
                    $.when( tool.fetchData(word) ).then( dfd.resolve );
                }).promise().pipe(function( data ) {
                    return {
                        response: data, 
                        tool: tool
                    };   
                });

                promises.push(promise);
            });
            
            return promises;
        },
         
        tools: {},
        
        suggest: {
            name: 'suggest',
            getHolderItem: function (response) {

                if (response.phrasalWords.length) {
                    response.suggest = this.assignPhrasalVerbs(response);
                }

                var items = [];
                
                $.each(response.suggest, function (i, word) {
                    var item = {
                        label: $.type(word) === OBJECT ? word.word : word,
                        assignSynonyms: TRUE,
                        order: word === response.word ? 1 : 20, //slovo na vstupu chci mit na prvni pozici
                        children: function () {
                            var children = [];
                            $.each(word.children || [], function (i, child) {
                                var item = {
                                    label: child,
                                    word: word.word + ' ' + child,
                                    assignSynonyms: TRUE,
                                    focus: function (e) {
                                        $.ln.tools.synonyms.fetchSynonym(this.word);
                                    },
                                    select: function (e) {
                                        $.ln.insertWord(this.word);
                                    }
                                };
                                children.push(item);
                            });
                            return children;
                        },
                        focus: function (e) {
                            $.ln.tools.synonyms.fetchSynonym(this.label);
                        },
                        select: function (e) {
                            $.ln.insertWord(this.label);
                        }
                    };
                    
                    items.push(item);
                
                });
                return items;
            },
            
            deferred: NULL,
            
            fetchData: function (word) {
                var self = this;
                
                if (self.deferred) {
                    if (self.deferred.isResolved() === FALSE) {
                        self.deferred.reject();
                    }
                }
                
                return $.Deferred(function( dfd ){
                    self.deferred = dfd;
                    self.lastFetchedWord = word;

                    return $.ln.fetchRemote(self.name, word)
                    .then( function (data) {
                        if (data.word !== self.lastFetchedWord) { //vratil se pozadavek na jiz neplatne slovo
                            dfd.reject();
                        } else {
                            dfd.resolve(data);
                        }
                    }, dfd.reject);
                }).promise();
            },
            
            /**
             * priradi frazove slovesa z pole data.phrasalWords k slovum do pole data.suggest
             */
            assignPhrasalVerbs: function (data) {
                var self = this;
                $.each(data.suggest, function(i, e) {
                    var phrasal = self.findPhrasal(e, data.phrasalWords);
                    if (phrasal.length) {
                        data.suggest[i] = {
                            word: e,
                            children: phrasal
                        };
                    }
                });
                return data.suggest;
            },

            /**
             * zkontroluje, zda v array je slovo, ktere zacina word
             */
            findPhrasal: function(word, array) {
                word += ' ';
                var words = [];
                $.each(array, function(i, phrasal) {
                    if (phrasal.indexOf(word) === 0) {
                        /**
                         * kdyz to mam bez prvniho slova, tak mi to do textarey opravdu vklada bez prvniho slova :D
                         */
                        words.push(phrasal.substr(phrasal.indexOf(' ') + 1)); //chci to bez prvniho slova
                    }
                });

                return words;
            }
        },
        
        showTools: function () {
            var word = $.ln.getWord();
            
            if(word === NULL){
                return FALSE;
            }
            
            $.when.apply( NULL, $.ln.fetchToolsPromises(word) )
            .then(function(){
                
                function insertItem(item, array) {
                    array.push(item);
                }
                
                var items = [];
                
                $.each(arguments, function(i, promise) {
                    var holderItem = promise.tool.getHolderItem(promise.response);
                    if ($.type(holderItem) === ARRAY) {
                        $.each(holderItem, function (x, item) {
                            insertItem(item, items);
                        });
                    } else {
                        insertItem(holderItem, items);
                    }
                    
                });

                $.ln.fillHolder(items);

            });
        },
        
        infoIsOpen: FALSE,

        setCookie: function (key, o) {
            if ($.ln.useCookie !== FALSE){
                $.cookie(key, $.toJSON(o));
            }
            return this;
        },

        getCookie: function (key) {
            if ($.ln.useCookie !== FALSE){
                return $.secureEvalJSON( $.cookie(key) ) || NULL;
            }
        },
    
        
    
        get: function (key) {
            var myKey = $.ln.options.cookiePrefix + key;
            return this[myKey] || $.ln.getCookie(myKey) || this.options[key];
        },

        set: function (key, o) {
            var myKey = $.ln.options.cookiePrefix + key;
            this[myKey] = o;
            return $.ln.setCookie(myKey, o);
        },
        
        showInfo: function (args) {
            
            if ($.ln.infoIsOpen) {
                $('.' + $.ln.options.infoDivClass).find('.ui-dialog-title').text( args.title );
                $.ln.getInfoContent().html( args.html ).scrollTop(0);
                return;
            }
            
            $.ln.hideInfo();

            /**
             * bylo nutne zakomentovat konec metody open v dialogu v jquery ui souboru
             * pri otevreni dialogu se automaticky focus()oval a neexistoval zpusob, jak tomu zabranit
             */
            $('<div>')
            .html(args.html || '')
            .dialog({
                position: $.ln.get('infoPosition'),
                close: $.ln.hideInfo,
                dialogClass: $.ln.options.infoDivClass,
                width: $.ln.get('infoSize').width,
                height: $.ln.get('infoSize').height,
                title: args.title || '',
                dragStop: function(event, ui) {
                    $.ln.set('infoPosition', [ui.offset.left, ui.offset.top]);
                },
                resizeStop: function(event, ui) {
                    $.ln.set('infoSize', ui.size)
                    .set('infoPosition', [ui.position.left, ui.position.top]);
                }
            })
            .delegate('.word, .derivedWord', {
                click: function(e) {
                    var word = $(this).text();
                    if (e[$.ln.options.controlKey]) {
                        $.ln.tools.synonyms.fetchSynonym(word);
                        $.ln.clearBlurElementTimer();
                    } else {
                        $.ln.insertWord(word);
                    }
                },
                mouseenter: function () {
                    $(this).addClass('wordHover');
                },
                mouseleave: function () {
                    $(this).removeClass('wordHover');
                }
            });
            
            $.ln.infoIsOpen = TRUE;
            $.ln.bringHolderToFront();
        },
        
        hideInfo: function () {
            $.ln.infoIsOpen = FALSE;
            $('.' + $.ln.options.infoDivClass).remove();
        },
        
        keyPressed: function (forced) {

            if ($.ln.options.autoShow === FALSE && forced === FALSE) {
                return FALSE;
            }

            var word = $.ln.getWord();
            
            if(word === NULL){
                $.ln.hideHolder();
                return FALSE;
            }

            var now = $.ln.microtime(true);
            if (now - $.ln.lastTimePressed < ($.ln.options.keyPressDelay / 1000)) { //musi uplynout 400ms od stisknuti klavesy aby se poslal pozadavek na server
                clearTimeout($.ln.suggestTimer);
            }

            $.ln.lastTimePressed = now;

            $.ln.suggestTimer = setTimeout(function() {
                $.ln.suggest.fetchData(word)
                .then(function (data) {
                    if (data.suggest.length) {
                        var items = $.ln.suggest.getHolderItem(data);
                        $.ln.fillHolder(items);
                    } else {
                        /**
                         * rozkliknuti misspeled nabidky doprava
                         */
                        $.ln.getActiveElement().bind('onFillHolder', function () {
                            $.ln.holder.trigger($.Event('keydown', {
                                keyCode: $.ui.keyCode.RIGHT
                            }));
                            $.ln.getActiveElement().unbind('onFillHolder');
                        });
                        
                        $.ln.showTools();
                    }
                });
            }, $.ln.options.keyPressDelay);

            return TRUE;
        },

        fetchRemote: function (type, word) {
            return $.ajax({
                url: $.ln.options.apiUrl + type,
                dataType: 'json',
                data: {
                    'w': word
                }
            });
        },

        getWord: function () {
            var pos = $.ln.getCaretPosition(),
            text = $.ln.getElementValue();

            return $.ln.parseWordFromText(pos, text);
        },

        parseWordFromText: function (pos, text) {
            var word = '',
            x = pos;
            
            /**
             * slouzi pro vlozeni slova do editoru
             * rika, kolik znaku od kurzoru vlevo a vpravo ma rozsah nahrazovane slovo
             * @example wor|l ~ left 3, right 1
             */
            $.ln.wordSize = {
                right: 0, 
                left: 0
            };
            
            while ($.ln.isLetter(text[--x])) {
                $.ln.wordSize.left++;
                word = text[x] + word;
            }

            while ($.ln.isLetter(text[pos])) {
                $.ln.wordSize.right++;
                word += text[pos++];
            }

            $.ln.lastWrittenWord = $.type(text[pos]) === UNDEFINED ? TRUE : FALSE;
            
            return word !== '' ? word : NULL;
        },
        
        isLetter: function (ch) {
            return $.type(ch) !== 'string' ? FALSE : /[a-zA-Z\-]/.test(ch);
        },
        
        microtime: function(get_as_float) {
            // Returns either a string or a float containing the current time in seconds and microseconds
            //
            // version: 812.316
            // discuss at: http://phpjs.org/functions/microtime
            // +   original by: Paulo Ricardo F. Santos
            // *     example 1: timeStamp = microtime(true);
            // *     results 1: timeStamp > 1000000000 && timeStamp < 2000000000
            var now = new Date().getTime() / 1000;
            var s = parseInt(now, 10);

            return (get_as_float) ? now : (Math.round((now - s) * 1000) / 1000) + ' ' + s;
        }
    };
    
    /**
     * init languator
     * kontroluje pritomnost pluginu
     */
    $(function () {
        $.ln.init();
    });
    
    $.extend($.ln.tools, {
        
        /**
         * /misspeled tool plugin
         */
        misspelled: {
            name: 'misspelled',
            order: 10,
            getHolderItem: function (response) {
                var self = this;
                if (response.misspelled === false) {
                    return 'spelling ok';
                } else {
                    return {
                        label: 'spelling incorrect',
                        subtitle: '(' + response.suggestions.length + ')',
                        order: self.order,
                        children: function () {
                            var children = [];

                            $.each(response.suggestions || [], function(i, word) {
                                var child = {
                                    label: word,
                                    assignSynonyms: TRUE,
                                    focus: function (e) {
                                        $.ln.tools.synonyms.fetchSynonym(this.label);
                                    },
                                    select: function (e) {
                                        $.ln.insertWord(word);
                                    }
                                };
                                children.push( child );
                            });
                            return children;
                        }
                    };
                }
            },
            fetchData: function (word) {
                return $.ajax({
                    url: '/api/misspelled',
                    dataType: 'json',
                    data: {
                        'w': word
                    }
                });
            }
        },
        
        irregularverbs: {
            name: 'irregularverbs',
            order: 20,
            getHolderItem: function (response) {
                var self = this;
                if (response.isirregular !== true) {
                    return 'not an irregular verb';
                } else {
                    return {
                        label: 'other tenses',
                        subtitle: '(' + response.verbs.length + ')',
                        order: self.order,
                        children: function () {
                            var children = [];

                            $.each(response.verbs || [], function(i, verb) {
                                var child = {
                                    label: verb.word,
                                    assignSynonyms: TRUE,
                                    subtitle: function () {
                                        var sub = '';
                                        switch (verb.tense) {
                                            case '1':
                                                sub += 'infinitive';
                                                break;
                                            case '2':
                                                sub += 'simple past';
                                                break;
                                            case '3':
                                                sub += 'past participle';
                                                break;
                                        }
                                        
                                        if (verb.archaic === true) {
                                            sub += ' (arch)';
                                        }
                                    
                                        return sub;
                                    },
                                    focus: function (e) {
                                        $.ln.tools.synonyms.fetchSynonym(this.label);
                                    },
                                    select: function (e) {
                                        $.ln.insertWord(verb.word);
                                    }
                                };
                                children.push( child );
                            });
                            return children;
                        }
                    };
                }
            },
            fetchData: function (word) {
                return $.ln.fetchRemote(this.name, word);
            }
        },
        
        /**
         * /synonyms tools plugin
         */
        synonyms: {
            name: 'synonyms',
            order: 30,
            noneLabel: 'none',
            getHolderItem: function (response) {
                var self = this,
                item = {
                    focus: function (e) {
                        self.showSynonymInfo(response.word, response.synonyms);
                    }
                };
                
                if ($.isEmptyObject( response.synonyms )) {
                    $.extend(item, {
                        label: 'no synonyms'
                    });
                } else {
                    $.extend(item, {
                        label: 'synonyms',
                        subtitle: '(' + response.synonyms.length + ')',
                        icon: 'ui-icon-newwin',
                        order: self.order
                    });
                }
                return item;
            },
            fetchData: function (word) {
                return $.ln.fetchRemote(this.name, word);
            },

            fetchSynonym: function(word) {
                var self = this;
                self.lastFetchedWord = word;
                return $.ln.fetchRemote('synonyms', word).then(function(syn){
                    if (self.lastFetchedWord !== syn.word) {
                        return;
                    }
                    self.showSynonymInfo(syn.word, syn.synonyms);
                });
            },

            showSynonymInfo: function(word, synonyms) {
                $.ln.showInfo({
                    title: 'Synonyms for ' + word,
                    html: $.isEmptyObject(synonyms) ? this.noneLabel : this.prepareSynonymContent(synonyms)
                });
            },

            
            defaultSynonymTemplate: ' ' +            
                '<div id="synonymTooltip">' +
                    '<div class="content">' +
                        '<ul class="synonyms">' +
                            '<li class="synonym template">' +
                                '<span class="pos"> POS </span> - ' +
                                '<span class="wordWrap template"><span title="Insert into editor" class="word">word</span></span> ' +
                                '<span class="word glue">, </span>' +
                                '<span class="gloss">gloss</span>; ' +
                                '<span class="exampleWrap template">"<span class="example">example</span>"</span>' +
                                '<span class="example glue">, </span>' +
                            '</li>' +
                        '</ul>' +
                    '</div>' +
                '</div>',
            
            /**
             *  zpracuje json data do templaty
             */
            prepareSynonymContent: function (synonyms) {
                var $synonymTooltip = $(this.defaultSynonymTemplate).clone(),
                $ulHolder = $synonymTooltip.find('ul.synonyms');

                if($ulHolder.find('.glue').length){
                    $.data($synonymTooltip, 'glue', {
                        'word': $ulHolder.find('.word.glue').text(),
                        'example': $ulHolder.find('.example.glue').text()
                    });
                    $ulHolder.find('.glue').remove();
                }

                $.each(synonyms, function(i, synonym){
                    var $newLi = $ulHolder.find('li.template').clone().removeClass('template'),
                    $wordTemplate = $newLi.find('.wordWrap.template'),
                    $exampleTemplate = $newLi.find('.exampleWrap.template');
                    $newLi
                    .find('.pos').text(synonym[0].substr(0, 1).toUpperCase()).attr('title', synonym[0])
                    .end()
                    .find('.gloss').text(synonym[2]);

                    $.each(synonym[1], function(j, word){
                        var $newWord = $wordTemplate.clone().removeClass('template');
                        $newWord.find('.word').text(word).end().insertAfter($newLi.find('.wordWrap:last'));
                    });
                    $.each(synonym[3], function(j, example){
                        var $newExample = $exampleTemplate.clone().removeClass('template');
                        $newExample.find('.example').text(example).end().insertAfter($newLi.find('.exampleWrap:last'));
                    });

                    var $words2glue = $newLi.find('.wordWrap:not(:last,.template)'),
                    $examples2glue = $newLi.find('.exampleWrap:not(:last,.template)');
                    if($words2glue.length){
                        $words2glue.after($.data($synonymTooltip, 'glue').word);
                    }
                    if($examples2glue.length){
                        $examples2glue.after($.data($synonymTooltip, 'glue').example);
                    }
                    $newLi.appendTo($ulHolder);
                });
                $ulHolder.find('.template').remove();
                $ulHolder.appendTo($synonymTooltip.find('div.content'));

                return $synonymTooltip.show();
            }
        },
        
        /**
         * /derived words tool plugin
         */
        derivedwords: {
            name: 'derivedwords',
            order: 40,
            noneLabel: 'none',
            getHolderItem: function (response) {
                var self = this,
                item = {
                    focus: function (e) {
                        $.ln.showInfo({
                            title: 'Derived words for ' + response.word,
                            html: $.isEmptyObject(response.derivedWords) ? self.noneLabel : self.prepareDerivedContent(response.derivedWords)
                        });
                    }
                };
            
                if ($.isEmptyObject( response.derivedWords )) {
                    $.extend(item, {
                        label: 'no derived words'
                    });
                } else {
                    $.extend(item, {
                        label: 'derived words',
                        subtitle: '(' + response.derivedWords.length + ')',
                        order: self.order,
                        icon: 'ui-icon-newwin'
                    });
                }
            
                return item;
            },
            fetchData: function (word) {
                return $.ln.fetchRemote(this.name, word);
            },
            
            defaultDerivedTemplate: ' ' + 
                '<div id="derivedTooltip">' +
                    '<div class="content">' +
                        '<ul class="deriveds">' +
                            '<li class="derived template">' +
                                '<span title="Insert into editor" class="derivedWord">derived word</span>' +
                                '<ul class="synonyms">' +
                                    '<li class="synonym template">' +
                                        '<span class="pos"> POS </span> - ' +
                                        '<span class="wordWrap template"><span title="Insert into editor" class="word">word</span></span> ' +
                                        '<span class="word glue">, </span>' +
                                        '<span class="gloss">gloss</span>; ' +
                                        '<span class="exampleWrap template">"<span class="example">example</span>"</span>' +
                                        '<span class="example glue">, </span>' +
                                    '</li>' +
                                '</ul>' +
                            '</li>' +
                        '</ul>' +
                    '</div>' +
                '</div>',
            
            /**
             * zpracuje json data do templaty
             */
            prepareDerivedContent: function (derivedWords){

                var $derivedTooltip = $(this.defaultDerivedTemplate).clone(),
                $ulHolder = $derivedTooltip.find('ul.deriveds');

                if($ulHolder.find('.glue').length){
                    $.data($derivedTooltip, 'glue', {
                        'word': $ulHolder.find('.word.glue').text(),
                        'example': $ulHolder.find('.example.glue').text()
                    });
                    $ulHolder.find('.glue').remove();
                }

                $.each(derivedWords, function(i, derived){
                    var $newLiDerived = $ulHolder.find('li.derived.template').clone().removeClass('template');
                    $newLiDerived.find('.derivedWord').text(derived.word);

                    if(derived.synonyms.length > 0){
                        $.each(derived.synonyms, function (ii, synonym) {
                            var $newLi = $newLiDerived.find('li.synonym.template').clone().removeClass('template'),
                            $wordTemplate = $newLi.find('.wordWrap.template'),
                            $exampleTemplate = $newLi.find('.exampleWrap.template');
                            $newLi
                            .find('.pos').text(synonym[0].substr(0, 1).toUpperCase()).attr('title', synonym[0])
                            .end()
                            .find('.gloss').text(synonym[2]);

                            $.each(synonym[1], function(j, word){
                                var $newWord = $wordTemplate.clone().removeClass('template');
                                $newWord.find('.word').text(word).end().insertAfter($newLi.find('.wordWrap:last')).fadeIn();
                            });
                            $.each(synonym[3], function(j, example){
                                var $newExample = $exampleTemplate.clone().removeClass('template');
                                $newExample.find('.example').text(example).end().insertAfter($newLi.find('.exampleWrap:last'));
                            });

                            var $words2glue = $newLi.find('.wordWrap:not(:last,.template)'),
                            $examples2glue = $newLi.find('.exampleWrap:not(:last,.template)');
                            if($words2glue.length){
                                $words2glue.after($.data($derivedTooltip, 'glue').word);
                            }
                            if($examples2glue.length){
                                $examples2glue.after($.data($derivedTooltip, 'glue').example);
                            }
                            $newLi.appendTo($newLiDerived.find('ul'));
                        });
                    }
                    $newLiDerived.appendTo($ulHolder);
                });
                $ulHolder.find('.template').remove();
                $ulHolder.appendTo($derivedTooltip.find('div.content'));

                return $derivedTooltip.show();
            }
        }
    });    


}( jQuery ));

/**
 * example of simple tool
 * inserts the word reversed
 */
//(function ( $ ) {
//    $.extend($.ln.tools, {
//        reverse: {
//            getHolderItem: function (response) {
//                return {
//                    label: response,
//                    order: 1,
//                    icon: 'ui-icon-arrowrefresh-1-s',
//                    select: function () {
//                        $.ln.insertWord(this.label);
//                    }
//                }
//            },
//            fetchData: function (word) {
//                return word.split('').reverse().join('');
//            }
//        }
//    });
//}( jQuery ));

/**
 * just logging
 */
function c(s) {
    if (window.console && jQuery.isFunction(window.console.log)) {
        window.console.log(s);
    }
}
