ymaps.ready(['AddressDelivery']).then(function init() {

    var json = {
        city: "Москва",
        polygons: {}
    };

    if($("#map-address").length <= 0){
        return true;
    }
    var defaultCoords = [59.9388, 30.3161];
    var mapNew = new ymaps.Map("map-address", {
            center: defaultCoords,
            zoom: 9,
            controls: ["zoomControl"]
        }, {}),
        cityPolygon,
        searchDeliveryControl = new ymaps.control.SearchControl({
            options: {
                useMapBounds: true,
                noCentering: true,
                noPopup: true,
                noPlacemark: true,
                placeholderContent: 'Адрес доставки',
                size: 'large',
                float: 'none',
                position: {right: 10, top: 10}
            }
        }),
    addressClass = new ymaps.AddressDelivery(mapNew);
    mapNew.behaviors.disable('scrollZoom');
    $("body").on("keyup", "#js-order-adress-map-input-floor",
        $.proxy(addressClass.__setFlat, addressClass, $("#js-order-adress-map-input-floor").get(0)));

    $("body").on("click", "#js-map-address-apply",
        $.proxy(addressClass.__applyAddress, addressClass)
    );

    ymaps.geocode(json.city, {
        results: 1
    }).then(function (res) {
        mapNew.setCenter(res.geoObjects.get(0).geometry.getCoordinates());
    });

    $('.order-adress-map-form').submit(function(){
        ymaps.geocode($('#js-order-adress-map-input').val(), {
            results: 1,
        }).then(function (res) {
            if(res.geoObjects.properties._data.metaDataProperty.GeocoderResponseMetaData.found > 0){
                res.geoObjects.each(function(item){
                    var address = item.properties._data.metaDataProperty.GeocoderMetaData.Address.Components;
                    var label = getAddressLine(address);
                    $('#js-order-adress-map-input').val(label);
                });
                addressClass.setPoint(res.geoObjects.get(0).geometry.getCoordinates());
            }
        });
        return false;
    });

    if($.fn.autocomplete){
        $('#js-order-adress-map-input').autocomplete({
            source: function(req, autocompleteRes){
                ymaps.geocode(req.term, {
                    results: 10
                }).then(function (res) {
                    var result = [];
                    res.geoObjects.each(function(item){
                       
                        var label = item.getAddressLine();
                        var value = label;
                        var coords = item.geometry.getCoordinates();
                        result.push({
                            label: label,
                            value: value,
                            coords: coords,
                            balloonContent: item.properties.get("balloonContent"),
                            postalCode: item.properties._data.metaDataProperty.GeocoderMetaData.AddressDetails.Country.AdministrativeArea.Locality.Thoroughfare.Premise.PostalCode.PostalCodeNumber
                        });
                    })
                    autocompleteRes(result);
                });
            },
            select: function(e, selected){
                addressClass.setPoint(selected.item.coords);
                $("#postal-code").val(selected.item.postalCode);
            }
        });
    }
    mapNew.events.add('adress-changed', function(e){
        var address = e.get('geocode').properties._data.metaDataProperty.GeocoderMetaData.Address.Components;
        $input = $('#js-order-adress-map-input');
        $input.val(getAddressLine(address));
        if(!!$input.val())
            $input.removeClass("error").parent().removeClass("error");
    });

    mapNew.container.fitToViewport(true);

    function getAddressLine(address) {  
        var res = [];
        var locations = ["locality","district","street","house"];
        locations.forEach(function(_item, _i, _arr) {
            address.forEach(function(item, i, arr) {
                if(item.kind == _item){
                    if(_item == "district" && 
                        (item.name.indexOf("микрорайон") >= 0 || item.name.indexOf("район") >= 0)){
                        return;
                    }
                    res.push(item.name);
                }
            });
        });
        res = res.join(', ');
        return res;
    }
});