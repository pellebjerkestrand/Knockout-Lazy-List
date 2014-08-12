(function(document, ko, $){
    ko.bindingHandlers.lazyScrubberVertical = {
        init: function(element, valueAccessor){
            var options = valueAccessor(),
                percentage = options.percentage || function(){};

            element.onmousedown = function(){
                $(document.body).addClass('no-select');

                document.onmousemove = function(event){
                    percentage(((event.pageY - element.parentNode.getBoundingClientRect().top) - (element.offsetHeight / 2)) / element.parentNode.offsetHeight);
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

            $(element).css('top', (on / max * 100) + "%");
        }
    };
})(document, ko, jQuery);