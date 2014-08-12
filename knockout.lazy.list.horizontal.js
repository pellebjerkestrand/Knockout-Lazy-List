(function($, ko){
    var states = {
        initial: 'initial',
        error: 'error',
        loading: 'loading',
        success: 'success'
    };

    function LazyListHorizontal(options){
        var self = this,
            pageSize = options.pageSize || 30;

        self.state = ko.observable(states.initial);

        self.data = ko.observableArray([]);

        // NOTE: ko.postbox vs. custom binding handler for sending, receiving filtered, sorted data

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

        self.pageSize = ko.observable(pageSize);

        self.visibleData = ko.computed(function(){
            var start = parseInt(self.on()),
                page = parseInt(self.pageSize());

            if(isNaN(start) || isNaN(page)){
                self.state(states.error);

                return [];
            }

            var filtered = self.filtered();

            var data = [];

            for(var i = 0; i < filtered.length; i++){
                data.push(filtered[i].days.slice(start, start + page));
            }

            return data;
        });

        self.headers = ko.observableArray([]);

        self.visibleHeaders = ko.computed(function(){
            var start = parseInt(self.on()),
                page = parseInt(self.pageSize());

            if(isNaN(start) || isNaN(page)){
                self.state(states.error);

                return [];
            }

            return self.headers().slice(start, start + page);
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
            var row = self.filtered()[0];

            if(row && Array.isArray(row.days)){
                return row.days.length;
            }

            return 0;
        });

        self.max = ko.computed(function(){
            var max = self.getNumberOfDays() - self.pageSize();

            if(max < 0){
                max = 0;
            }

            return max;
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

        self.noop = function(){
            console.log(arguments);
        };

        self.onWheel = function(event){
            var start = parseInt(self.on()),
                max = parseInt(self.max()),
                end = 0;

            if(isNaN(start) || isNaN(max)){
                return;
            }

            var deltaY = event.deltaY;

            if(event.webkitDirectionInvertedFromDevice){
                deltaY = -deltaY;
            }

            if((deltaY || event.detail || event.wheelDelta) < 0){
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