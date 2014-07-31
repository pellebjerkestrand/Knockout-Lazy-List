(function($, ko, document){
    var states = {
            initial: 'initial',
            error: 'error',
            loading: 'loading',
            success: 'success'
        },
        modes = {
            horizontal: 'horizontal',
            vertical: 'vertical'
        },
        wheelEvent = ("onwheel" in document || document.documentMode >= 9) ? "wheel" : (document.onmousewheel !== undefined ? "mousewheel" : "DOMMouseScroll");

    ko.bindingHandlers.lazyScrubber = {
        init: function(element, valueAccessor){
            var options = valueAccessor(),
                mode = options.mode || modes.vertical,
                percentage = options.percentage || function(){};

            element.onmousedown = function(){
                $(document.body).addClass('no-select');

                document.onmousemove = function(event){
                    var pos = (mode == modes.vertical) ? (event.pageY - element.parentNode.getBoundingClientRect().top) : (event.pageX - element.parentNode.getBoundingClientRect().left),
                        offset = ((mode == modes.vertical) ? element.offsetHeight : element.offsetWidth) / 2,
                        parent = (mode == modes.vertical) ? element.parentNode.offsetHeight : element.parentNode.offsetWidth;

                    /*
                    if(pos > offset && (pos - offset) <= parent){
                        $(element).css((mode == modes.vertical) ? 'top' : 'left', (pos - offset) + 'px');
                    }
                    */

                    percentage((pos - offset) / parent);
                };

                document.onmouseup = function(){
                    $(document.body).removeClass('no-select');
                    document.onmousemove = document.onmouseup = null;
                };
            };
        },
        update: function(element, valueAccessor){
            var options = valueAccessor(),
                on = options.on || 0,
                max = options.max || 0;

            $(element).css((options.mode === options.vertical) ? 'top' : 'left', (on / max * 100) + "%");
        }
    };

    ko.bindingHandlers.scroll = {
        init: function(element, valueAccessor){
            element.addEventListener(wheelEvent, valueAccessor(), false);
        }
    };

    function LazyList(options){
        var self = this,
            mode = options.mode || modes.vertical,
            pageSize = options.pageSize || 30;

        self.state = ko.observable(states.initial);
        self.data = ko.observableArray([]);
        self.filtered = ko.computed(function(){
            return self.data().filter(function(){
                    // TODO: Filters. Array.prototype.filter(callback[, thisArg]) https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
                    return true;
                }
            );
        });
        self.sorted = ko.computed(function(){
            var sorted = self.filtered();

            // TODO: Sorts. Array.prototype.sort([compareFunction]) https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/sort

            return sorted;
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
        self.pageSize = ko.observable(pageSize);
        self.visible = ko.computed(function(){
            var start = parseInt(self.on()),
                page = parseInt(self.pageSize());

            if(isNaN(start) || isNaN(page)){
                self.state(states.error);

                return [];
            }

            var filtered = self.filtered();

            if(mode === modes.horizontal){
                var data = [];

                for(var i = 0; i < filtered.length; i++){
                    data.push(filtered[i].days.slice(start, start + page));
                }

                return data;
            }

            return filtered.slice(start, start + page);
        });

        self.getNumberOfDays = ko.computed(function(){
            var row = self.filtered()[0];

            if(row && Array.isArray(row.days)){
                return row.days.length;
            }

            return 0;
        });

        self.max = ko.computed(function(){
            var length = (mode === modes.horizontal) ? self.getNumberOfDays() : self.filtered().length,
                max = length - self.pageSize();

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