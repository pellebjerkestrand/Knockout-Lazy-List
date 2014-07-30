(function($, ko, document){
    var states = {
            initial: 'initial',
            error: 'error',
            loading: 'loading',
            success: 'success'
        };

    ko.bindingHandlers.lazyScrubber = {
        init: function(element, valueAccessor){
            var $element = $(element);

            element.onmousedown = function(event){
                $(document.body).addClass('no-select');

                var startY = event.pageY;

                document.onmousemove = function(event){
                    var pos = event.pageY - element.parentNode.getBoundingClientRect().top,
                        offset = element.offsetHeight / 2;

                    if(pos > offset && (pos - offset) <= element.parentNode.offsetHeight){
                        $element.css('top', (pos - offset) + 'px');
                    }

                    valueAccessor().percentage((pos - offset) / element.parentNode.offsetHeight);
                };

                document.onmouseup = function(event){
                    $(document.body).removeClass('no-select');
                    document.onmousemove = document.onmouseup = null;
                };
            };
        },
        update: function(element, valueAccessor){
            var input = valueAccessor();

            $(element).css('top', (input.on / input.max * 100) + "%");
        }
    };

    ko.bindingHandlers.scroll = {
        update: function(element, valueAccessor){
            element.addEventListener(("onwheel" in document || document.documentMode >= 9) ? "wheel" : (document.onmousewheel !== undefined ? "mousewheel" : "DOMMouseScroll"), valueAccessor(), false);
        }
    };

    function LazyList(options){
        var self = this;

        self.state = ko.observable(states.initial);
        self.data = ko.observableArray([]);
        self.filter = ko.observable('');
        self.filtered = ko.computed(function(){
            // TODO: Filters
            return self.data();
        });
        self.on = ko.observable(0);
        self.previous = function(){
            if(self.on() > 0){
                self.on(self.on() - 1);
            }
        };
        self.next = function(){
            if(self.on() < self.max()){
                self.on(self.on() + 1);
            }
        };
        self.previousPage = function(){
            var on = parseInt(self.on()),
                size = parseInt(self.pageSize());

            if(on > size){
                self.on(on - size);
            } else {
                self.firstPage();
            }
        };
        self.nextPage = function(){
            var on = parseInt(self.on()),
                max = parseInt(self.max()),
                size = parseInt(self.pageSize());

            if(on < max - size){
                self.on(on + size);
            } else {
                self.lastPage();
            }
        };
        self.firstPage = function(){
            self.on(0);
        };
        self.lastPage = function(){
            self.on(self.max());
        };
        self.pageSize = ko.observable(30);
        self.visible = ko.computed(function(){
            var start = parseInt(self.on()),
                page = parseInt(self.pageSize());

            if(isNaN(start) || isNaN(page)){
                self.state(states.error);

                return [];
            }

            return self.filtered().slice(start, start + page);
        });
        self.max = ko.computed(function(){
            var max = self.filtered().length - self.pageSize();

            if(max < 0){
                max = 0;
            }

            return max;
        });

        self.firstShown = ko.computed(function(){
            return self.on() + 1;
        });

        self.lastShown = ko.computed(function(){
            return self.on() + self.visible().length;
        });

        self.percentage = ko.computed({
            read: function(){
                return this.on()/this.max()*100 + "%";
            },
            write: function(percent){
                var max = this.max();

                this.on(Math.max(Math.min(Math.round(max * percent), max), 0));
            },
            owner: self
        });

        self.getProperties = function(object){
            var props = [];

            for(var prop in object){
                if(object.hasOwnProperty(prop)){
                    props.push(object[prop]);
                }
            }

            return props;
        };

        self.onWheel = function(event){
            var start = parseInt(self.on()),
                max = parseInt(self.max()),
                end = 0;

            if(isNaN(start) || isNaN(max)){
                return;
            }

            if((event.deltaX || event.detail || event.wheelDelta) < 0){
                end = start + 1;
            } else {
                end = start - 1;
            }

            if(end > -1 && end <= max){
                self.on(end);
                event.preventDefault();
            }
        };

        (function(){
            $.ajax({
                url: options.endpoint,
                type: 'get',
                beforeSend: function(){
                    self.state(states.loading);
                },
                success: function(data){
                    self.data(data);
                    self.state(states.success);
                },
                error: function(){
                    self.state(states.error);
                }
            });
        })();
    }

    $(function(){
        $('[data-lazy-list]').each(function(){
            ko.applyBindings(new LazyList($(this).data('lazy-list')), this);
        });
    });
})(jQuery, ko, document);