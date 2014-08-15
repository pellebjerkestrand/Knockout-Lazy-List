(function($, ko){
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

    $(function(){
        $('[data-lazy-list-control-panel]').each(function(){
            ko.applyBindings(new LazyListControlPanel($(this).data('lazy-list-control-panel')), this);
        });
    });
})(jQuery, ko);