(function($, ko){
    var states = {
        initial: 'initial',
        error: 'error',
        loading: 'loading',
        success: 'success'
    };

    function LazyListVertical(options){
        var self = this,
            pageSize = options.pageSize || 30,
            filterTopic = options.filterTopic || 'LLFT',
            comparatorTopic = options.comparatorTopic || 'LLCT';

        self.state = ko.observable(states.initial);

        self.on = ko.observable(0);

        self.pageSize = ko.observable(pageSize);

        self.data = ko.observableArray([]);

        self.filters = ko.observableArray([]).subscribeTo(filterTopic);

        self.comparator = ko.observable(null).subscribeTo(comparatorTopic);

        self.processed = ko.computed(function(){
            var data = self.data(),
                filters = self.filters(),
                filtered = data;

            filters = filters.filter(function(value){
                return typeof value === 'function';
            });

            for(var i = 0; i < filters.length; i++){
                filtered = filtered.filter(filters[i]);
            }

            var comparator = self.comparator(),
                sorted = filtered;

            if(typeof comparator === 'function'){
                sorted = sorted.sort(comparator);
            }

            return sorted;
        });

        self.visible = ko.computed(function(){
            var start = self.on();

            return self.processed().slice(start, start + self.pageSize());
        });

        self.max = ko.computed(function(){
            var max = self.processed().length - self.pageSize();

            return max < 0 ? 0 : max;
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
            var start = self.on(),
                max = self.max(),
                end = 0,
                deltaY = event.deltaY || event.detail || event.wheelDeltaY;

            if(event.webkitDirectionInvertedFromDevice){
                deltaY = -deltaY;
            }

            if(deltaY < 0){
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
        $('[data-lazy-list-vertical]').each(function(){
            ko.applyBindings(new LazyListVertical($(this).data('lazy-list-vertical')), this);
        });
    });
})(jQuery, ko);