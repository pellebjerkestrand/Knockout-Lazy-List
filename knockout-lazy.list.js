(function(document, $, ko){
    function intersection(a, b){
        return a.filter(function(n){
            return b.indexOf(n) != -1;
        });
    }

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
            eventPosition: 'clientX',
            edge: 'left',
            offset: 'offsetLeft',
            size: 'width'
        },
        verticalConfiguration: {
            eventPosition: 'clientY',
            edge: 'top',
            offset: 'offsetTop',
            size: 'height'
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
                            var scrubberRect = element.getBoundingClientRect(),
                                trackRect = element.parentNode.getBoundingClientRect(),
                                mousePos = event[configuration.eventPosition],
                                trackEdge = trackRect[configuration.edge],
                                scrubberSize = scrubberRect[configuration.size],
                                trackSize = trackRect[configuration.size],
                                mousePosRelative = trackEdge - mousePos + (scrubberSize / 2);

                            if(mousePosRelative > 0){
                                mousePosRelative = 0;
                            } else {
                                mousePosRelative = Math.abs(mousePosRelative);
                            }

                            var percent = (mousePosRelative / trackSize);

                            if(percent >= 0 && percent <= 1){
                                percentage(percent);
                            }
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

                    $(element).css(configuration.edge, (on / max * 100) + "%");
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
                    dataTopic = options.dataTopic || 'LLDT',
                    filterTopic = options.filterTopic || 'LLFT',
                    comparatorTopic = options.comparatorTopic || 'LLCT';

                self.panels = options.controls || [];

                self.getComparator = function(propertyName, direction){
                    if(direction === directions.ascending){
                        return function(a, b){
                            if(a[propertyName] < b[propertyName]){
                                return -1;
                            }

                            if(a[propertyName] > b[propertyName]){
                                return 1;
                            }

                            return 0;
                        };
                    } else if (direction.toLowerCase() === directions.descending.toLowerCase()){
                        return function(a, b){
                            if(a[propertyName] > b[propertyName]){
                                return -1;
                            }

                            if(a[propertyName] < b[propertyName]){
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
                    var filterGroups = [];

                    for(var i = 0; i < self.panels.length; i++){
                        var actions = self.panels[i].actions,
                            filters = [],
                            facets = [];

                        for(var j = 0; j < actions.length; j++){
                            var action = actions[j];

                            if(action.type === actionTypes.text){
                                var filterText = action.filter();

                                if(filterText.length > 0){
                                    (function(propertyName, text){
                                        filters.push(function(item){
                                            return item[propertyName].toString().toLowerCase().indexOf(text.toString().toLowerCase()) != -1;
                                        });
                                    })(action.propertyName, filterText);
                                }
                            } else if (action.type === actionTypes.filter && action.active()){
                                facets.push({
                                    name: action.propertyName,
                                    value: action.propertyValue
                                });
                            }
                        }

                        if(facets.length > 0){
                            var facetFilter = (function(facets){
                                return function(item){
                                    var match = false;

                                    for(var i = 0; i< facets.length; i++){
                                        match = item[facets[i].name] === facets[i].value;

                                        if(match){
                                            break;
                                        }
                                    }

                                    return match;
                                };
                            })(facets);

                            filters.push(facetFilter);
                        } else {
                            filters.push(function(){ return true; });
                        }

                        filterGroups.push(filters);
                    }

                    return filterGroups;
                };

                self.filterHandler = function(){
                    ko.postbox.publish(filterTopic, self.getFilters());
                };

                ko.postbox.subscribe(dataTopic, self.filterHandler);

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
                    dataTopic = options.dataTopic || 'LLDT',
                    filterTopic = options.filterTopic || 'LLFT',
                    comparatorTopic = options.comparatorTopic || 'LLCT',
                    exportTopic = options.exportTopic || 'LLET',
                    clickTopic = options.clickTopic || 'LLCLT';

                self.on = ko.observable(0);

                self.state = ko.observable(listFactory.states.initial);

                self.pageSize = ko.observable(pageSize);

                self.data = ko.observableArray([]);

                self.filters = ko.observableArray([]).subscribeTo(filterTopic);

                self.comparator = ko.observable(null).subscribeTo(comparatorTopic);

                self.processed = ko.computed(function(){
                    var data = self.data(),
                        filters = self.filters(),
                        filtered = data,
                        groupedData = [];

                    if(filters.length > 0){
                        for(var i = 0; i < filters.length; i++){
                            var filterGroup = filters[i];

                            for(var j = 0; j < filterGroup.length; j++){
                                groupedData.push(data.filter(filterGroup[j]));
                            }
                        }

                        for(var k = 0; k < groupedData.length; k++){
                            if(k === 0){
                                filtered = groupedData[0]
                            } else {
                                filtered = intersection(filtered, groupedData[k]);
                            }
                        }
                    }

                    var comparator = self.comparator(),
                        sorted = filtered;

                    if(typeof comparator === 'function'){
                        sorted.sort(comparator);
                    }

                    self.on(0);

                    return sorted;
                });

                self.exportList = function() {
                    ko.postbox.publish(exportTopic, self.processed());
                };

                self.cellClick = function(item) {
                    ko.postbox.publish(clickTopic, item);
                };

                ko.utils.extend(self, new extensionModel(self.on, self.processed, self.pageSize, self.state, self.data, options.endpoint, dataTopic));

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

                    if(!event.webkitDirectionInvertedFromDevice){
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