(function($, ko){
    var states = {
        initial: 'initial',
        error: 'error',
        loading: 'loading',
        success: 'success'
    };

    function LazyListHorizontal(options){
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

        self.visibleData = ko.computed(function(){
            var start = self.on(),
                processed = self.processed(),
                result = [];

            for(var j = 0; j < processed.length; j++){
                result.push(processed[j].days.slice(start, start + self.pageSize()));
            }

            return result;
        });

        self.headers = ko.observableArray([]);

        self.visibleHeaders = ko.computed(function(){
            var start = self.on();

            return self.headers().slice(start, start + self.pageSize());
        });

        self.visibleGroups = ko.computed(function(){
            var visible = self.visibleHeaders() || [],
                columns = [],
                column = 0,
                previousTitle = '',
                count = 1,
                first = true;

            for(var i = 0; i < visible.length; i++){
                var title = visible[i].month;

                if(first){
                    columns.push({
                        title: title,
                        columns: count
                    });

                    first = false;
                } else {
                    if(previousTitle === title){
                        count++;
                        columns[column].columns = count;
                    } else {
                        count = 1;
                        column++;

                        columns.push({
                            title: title,
                            columns: count
                        });
                    }
                }

                previousTitle = title;
            }

            return columns;
        });

        self.getNumberOfDays = ko.computed(function(){
            var row = self.data()[0];

            return row && Array.isArray(row.days) ? row.days.length : 0;
        });

        self.max = ko.computed(function(){
            var max = self.getNumberOfDays() - self.pageSize();

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

            if((deltaY) < 0){
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
                success: function(response){
                    self.headers(response.headers);
                    self.data(response.data);
                    self.state(states.success);
                },
                error: function(){
                    self.state(states.error);
                }
            });
        })();
    }

    $(function(){
        $('[data-lazy-list-horizontal]').each(function(){
            ko.applyBindings(new LazyListHorizontal($(this).data('lazy-list-horizontal')), this);
        });
    });
})(jQuery, ko);