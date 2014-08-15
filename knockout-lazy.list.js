(function(document, $, ko){
    var scrollFactory = {
        getScroll: function(){
            var wheelEvent = ("onwheel" in document || document.documentMode >= 9) ? "wheel" : (document.onmousewheel !== undefined ? "mousewheel" : "DOMMouseScroll");

            return {
                init: function(element, valueAccessor){
                    element.addEventListener(wheelEvent, valueAccessor(), false);
                }
            };
        }
    };

    var scrubberFactory = {
        horizontalConfiguration: {
            eventDirection: 'pageX',
            parentEdge: 'left',
            offset: 'offsetWidth',
            scrubberProperty: 'left'
        },
        verticalConfiguration: {
            eventDirection: 'pageY',
            parentEdge: 'top',
            offset: 'offsetHeight',
            scrubberProperty: 'top'
        },
        getScrubber: function(configuration){
            configuration = configuration || scrubberFactory.verticalConfiguration;

            return {
                init: function(element, valueAccessor){
                    var options = valueAccessor(),
                        percentage = options.percentage || function(){};

                    element.onmousedown = function(){
                        $(document.body).addClass('no-select');

                        document.onmousemove = function(event){
                            percentage(((event[configuration.eventDirection] - element.parentNode.getBoundingClientRect()[configuration.parentEdge]) - (element[configuration.offset] / 2)) / element.parentNode[configuration.offset]);
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

                    $(element).css(configuration.scrubberProperty, (on / max * 100) + "%");
                }
            };
        }
    };

    var controlPanelFactory = {
        getControlPanel: function(options){
            var actionTypes = {
                    text: 'freeTextFilter',
                    ascending: 'alphabeticalAscendingSort',
                    descending: 'alphabeticalDescendingSort',
                    filter: 'fixedFilter'
                },
                directions = {
                    ascending: 'alphabeticalAscendingSort',
                    descending: 'alphabeticalDescendingSort'
                };

            function LazyListControlPanel(options){
                var self = this,
                    controls = options.controls || [],
                    filterTopic = options.filterTopic || 'LLFT',
                    comparatorTopic = options.comparatorTopic || 'LLCT';

                self.panels = controls;

                self.getComparator = function(propertyName, direction){
                    if(direction === directions.ascending){
                        return function(a, b){
                            if(a[propertyName].toLowerCase()[0] < b[propertyName].toLowerCase()[0]){
                                return -1;
                            }

                            if(a[propertyName].toLowerCase()[0] > b[propertyName].toLowerCase()[0]){
                                return 1;
                            }

                            return 0;
                        };
                    } else if (direction === directions.descending){
                        return function(a, b){
                            if(a[propertyName].toLowerCase()[0] > b[propertyName].toLowerCase()[0]){
                                return -1;
                            }

                            if(a[propertyName].toLowerCase()[0] < b[propertyName].toLowerCase()[0]){
                                return 1;
                            }

                            return 0;
                        };
                    }

                    return function(){
                        return 0;
                    };
                };

                self.comparatorHandler = function(data){
                    ko.postbox.publish(comparatorTopic, self.getComparator(data.propertyName, data.type));
                };

                self.getFilters = function(){
                    var filters = [],
                        facets = [];

                    for(var i = 0; i < self.panels.length; i++){
                        var actions = self.panels[i].actions;

                        for(var j = 0; j < actions.length; j++){
                            var action = actions[j];

                            if(action.type === actionTypes.text){
                                var filterText = action.filter();

                                if(filterText.length > 0){
                                    (function(propertyName, filterText){
                                        filters.push(function(item){
                                            return item[propertyName].toLowerCase().indexOf(filterText) != -1;
                                        });
                                    })(action.propertyName, filterText);
                                }
                            } else if (action.type === actionTypes.filter && action.active()){
                                (function(propertyName, propertyValue){
                                    facets.push(function(item){
                                        return item[propertyName].toLowerCase() === propertyValue.toLowerCase();
                                    });
                                })(action.propertyName, action.propertyValue);
                            }
                        }
                    }

                    if(facets.length > 0){
                        var facet = function(item){
                            var match = false;

                            for(var i = 0; i < facets.length; i++){
                                match = facets[i](item);

                                if(match){
                                    break;
                                }
                            }

                            return match;
                        };

                        filters.push(facet);
                    }

                    return filters;
                };

                self.filterHandler = function(){
                    ko.postbox.publish(filterTopic, self.getFilters());
                };

                self.freeTextFilterHandler = self.filterHandler;

                self.fixedFilterHandler = self.filterHandler;

                for(var i = 0; i < self.panels.length; i++){
                    var actions = self.panels[i].actions;

                    for(var j = 0; j < actions.length; j++){
                        var action = actions[j];

                        if(action.type === actionTypes.text){
                            action.filter = ko.observable('').extend({ rateLimit: 300 });
                            action.filter.subscribe(self.filterHandler);
                        } else if (action.type === actionTypes.filter){
                            action.active = ko.observable(true);
                            action.active.subscribe(self.filterHandler);
                        }
                    }
                }
            }

            return new LazyListControlPanel(options);
        }
    };

    var listFactory = {
        states: {
            initial: 'initial',
            error: 'error',
            loading: 'loading',
            success: 'success'
        },
        horizontalModel: function(on, processed, pageSize, state, data, endpoint){
            var self = this;

            self.visibleData = ko.computed(function(){
                var start = on(),
                    proc = processed(),
                    result = [];

                for(var j = 0; j < proc.length; j++){
                    result.push(proc[j].days.slice(start, start + pageSize()));
                }

                return result;
            });

            self.headers = ko.observableArray([]);

            self.visibleHeaders = ko.computed(function(){
                var start = on();

                return self.headers().slice(start, start + pageSize());
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
                var row = data()[0];

                return row && Array.isArray(row.days) ? row.days.length : 0;
            });

            self.max = ko.computed(function(){
                var max = self.getNumberOfDays() - pageSize();

                return max < 0 ? 0 : max;
            });

            self.init = function(){
                $.ajax({
                    url: endpoint,
                    type: 'get',
                    beforeSend: function(){
                        state(listFactory.states.loading);
                    },
                    success: function(response){
                        self.headers(response.headers);
                        data(response.data);
                        state(listFactory.states.success);
                    },
                    error: function(){
                        state(listFactory.states.error);
                    }
                });
            };
        },
        verticalModel: function(on, processed, pageSize, state, data, endpoint){
            var self = this;

            self.visible = ko.computed(function(){
                var start = on();

                return processed().slice(start, start + pageSize());
            });

            self.max = ko.computed(function(){
                var max = processed().length - pageSize();

                return max < 0 ? 0 : max;
            });

            self.init = function(){
                $.ajax({
                    url: endpoint,
                    type: 'get',
                    beforeSend: function(){
                        state(listFactory.states.loading);
                    },
                    success: function(result){
                        data(result);
                        state(listFactory.states.success);
                    },
                    error: function(){
                        state(listFactory.states.error);
                    }
                });
            };
        },
        baseModel: function(extensionModel, options){
            function LazyList(extensionModel, options){
                var self = this,
                    pageSize = options.pageSize || 30,
                    filterTopic = options.filterTopic || 'LLFT',
                    comparatorTopic = options.comparatorTopic || 'LLCT';

                self.on = ko.observable(0);

                self.state = ko.observable(listFactory.states.initial);

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

                    self.on(0);

                    return sorted;
                });

                ko.utils.extend(self, new extensionModel(self.on, self.processed, self.pageSize, self.state, self.data, options.endpoint));

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

                if(typeof self['init'] === 'function'){
                    self.init();
                }
            }

            return new LazyList(extensionModel, options);
        },
        getList: function(model, options){
            return listFactory.baseModel(model, options);
        }
    };

    ko.bindingHandlers.scroll = scrollFactory.getScroll();
    ko.bindingHandlers.lazyScrubberHorizontal = scrubberFactory.getScrubber(scrubberFactory.horizontalConfiguration);
    ko.bindingHandlers.lazyScrubberVertical = scrubberFactory.getScrubber(scrubberFactory.verticalConfiguration);

    $(function(){
        $('[data-lazy-list-control-panel]').each(function(){
            ko.applyBindings(controlPanelFactory.getControlPanel($(this).data('lazy-list-control-panel')), this);
        });

        $('[data-lazy-list-horizontal]').each(function(){
            ko.applyBindings(listFactory.getList(listFactory.horizontalModel, $(this).data('lazy-list-horizontal')), this);
        });

        $('[data-lazy-list-vertical]').each(function(){
            ko.applyBindings(listFactory.getList(listFactory.verticalModel, $(this).data('lazy-list-vertical')), this);
        });
    });
})(document, jQuery, ko);