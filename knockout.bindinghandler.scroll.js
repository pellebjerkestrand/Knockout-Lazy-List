(function(ko){
    var wheelEvent = ("onwheel" in document || document.documentMode >= 9) ? "wheel" : (document.onmousewheel !== undefined ? "mousewheel" : "DOMMouseScroll");

    ko.bindingHandlers.scroll = {
        init: function(element, valueAccessor){
            element.addEventListener(wheelEvent, valueAccessor(), false);
        }
    };
})(ko);