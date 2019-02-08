ymaps.modules.define(
    'AddressDelivery',
    ['util.defineClass', 'vow'],
    function (provide, defineClass, vow) {
        /**
         * @class AddressDelivery Адрес доставки.
         * @param {Object} map    Экземпляр карты.
         */
        function AddressDelivery(map) {
            this._map = map;
            this._addressPoint = null;
            this._priceDlivery = -1;
            this._route = null;
            this._balloon = null;
            this.addressSave = $("#address-save");
            this.addressView = $("#address-view");
            this.coordsAddress = $(".field_coordinate_delivery");
            this.addressData = "";
            this.contentSave = "";
            this.flatValue = "";

            this._addressPointBalloonContent;

            map.events.add('click', this._onClick, this);
        }

        defineClass(AddressDelivery, {
            /**
             * Задаём точке координаты и контент балуна.
             * @param {Number[]} position Координаты точки.
             * @param {String} content Контент балуна точки.
             */
            _setPointData: function (position, content) {
                this._addressPointBalloonContent = content;
                this._addressPoint.geometry.setCoordinates(position);
                this._addressPoint.properties.set('balloonContentBody', content);
                this._map.setCenter(position, 17);
                this.balloonOpen(position);
            },

            /**
             * Создаем новую точку маршрута и добавляем её на карту.
             * @param {Number[]} position Координаты точки.
             */
            _addNewPoint: function (position) {
                // Если новой точке маршрута не заданы координаты, временно задаём координаты вне области видимости.
                if (!position) position = [19.163570, -156.155197];
                var self = this;
                // Создаем маркер с возможностью перетаскивания (опция `draggable`).
                // По завершении перетаскивания вызываем обработчик `_onStartDragEnd`.
                this._addressPoint = new ymaps.Placemark(position, {}, {
                    draggable: true,
                    balloonAutoPan: false
                });

                this._addressPoint.events.add('click', function (e) {
                    e.preventDefault();
                    self.balloonOpen(self._addressPoint.geometry.getCoordinates());
                });
                this._addressPoint.events.add('dragend', this._onAddressDragEnd, this);
                this._map.geoObjects.add(this._addressPoint);
            },

            /**
             * Задаём точку маршрута.
             * Точку маршрута можно задать координатами или координатами с адресом.
             * Если точка маршрута задана координатами с адресом, то адрес становится контентом балуна.
             * @param {Number[]} position Координаты точки.
             * @param {String} address Адрес.
             */
            setPoint: function (position, address) {
                if(this._map.balloon.isOpen()){
                    this._map.balloon.close();
                }
                if (!this._addressPoint) {
                    this._addNewPoint(position);
                }
                if (!address) {
                    this._reverseGeocode(position).then(function (content) {
                        this._setPointData(position, content);
                        this._setupRoute();
                    }, this)
                } else {
                    this._setPointData(position, address);
                    this._setupRoute();
                }
                var self = this;
                ymaps.geocode(position).then(function (res) {
                    var firstGeoObject = res.geoObjects.get(0);
                    if(firstGeoObject && firstGeoObject.getAddressLine && firstGeoObject.getAddressLine()){
                        self._map.events.fire('adress-changed', {point: self._addressPoint, geocode: firstGeoObject});
                    }
                });
            },

            /**
             * Проводим обратное геокодирование (определяем адрес по координатам) для точки маршрута.
             * @param {Number[]} point Координаты точки.
             */
            _reverseGeocode: function (point) {
                var self = this;
                return ymaps.geocode(point).then(function (res) {
                    var firstGeoObject = res.geoObjects.get(0),
                        metaData;
                    // res содержит описание найденных геообъектов.
                    // Получаем описание первого геообъекта в списке, чтобы затем показать
                    // с описанием доставки по клику на метке.
                    if(firstGeoObject && firstGeoObject.properties.get('balloonContentBody')){
                        metaData = firstGeoObject.properties.get('metaDataProperty.GeocoderMetaData');

                        self.addressData = metaData.Address.formatted;
                        return res.geoObjects.get(0).properties.get('balloonContentBody');
                    }
                    return '';
                });

            },

            /**
             * Проводим прямое геокодирование (определяем координаты по адресу) для точки маршрута.
             * @param {String} address Адрес.
             */
            _geocode: function (address) {
                return ymaps.geocode(address).then(function (res) {
                    // res содержит описание найденных геообъектов.
                    // Получаем описание и координаты первого геообъекта в списке.
                    var balloonContent = res.geoObjects.get(0) &&
                            res.geoObjects.get(0).properties.get("balloonContent") || '',
                        coords = res.geoObjects.get(0) &&
                            res.geoObjects.get(0).geometry.getCoordinates() || '';

                    return [coords, balloonContent];
                });

            },

            /**
             *
             * @param  {Number} routeLength Длина маршрута в километрах.
             * @return {Number} Стоимость доставки.
             */
            calculate: function (routeLength) {
                // Константы.
                var DELIVERY_TARIF = 20, // Стоимость за километр.
                    MINIMUM_COST = 500; // Минимальная стоимость.

                return Math.max(routeLength * DELIVERY_TARIF, MINIMUM_COST);
            },

            /**
             * Прокладываем маршрут через заданные точки
             * и проводим расчет доставки.
             */
            _setupRoute: function () {
                // Удаляем предыдущий маршрут с карты.
                if (this._route) {
                    this._map.geoObjects.remove(this._route);
                }

                if (this._addressPoint) {
                    var finish = this._addressPoint.geometry.getCoordinates(),
                        finishBalloon = this._addressPointBalloonContent;
                    if (this._deferred && !this._deferred.promise().isResolved()) {
                        this._deferred.reject('New request');
                    }
                    var deferred = this._deferred = vow.defer();
                }
            },

            /**
             * Обработчик клика по карте. Получаем координаты точки на карте и создаем маркер.
             * @param  {Object} event Событие.
             */
            _onClick: function (event) {
                var coords = event.get('coords');
                this.setPoint(coords);
            },

            _setPrice: function (coords) {
                var self = this;
                this._priceDlivery = -1;
                this._map.geoObjects.each(function (el, i) {
                    if(el.geometry.getType().toLowerCase() == "polygon"){
                        if(el.geometry.contains(coords)){
                            self._priceDlivery = el.properties.get("price");
                        }
                    }
                });
                // this._map.events.fire('changed-price', {
                //     value: this._priceDlivery,
                //     label: this._priceDlivery == 0 ? "бесплатно" : ( this._priceDlivery > 0 ? this._priceDlivery + "р." : "Доставка не осуществляется" )
                // });
            },

            __setFlat: function (object, event) {
                if ( event.which == 13 ) {
                    event.preventDefault();
                }
                this.flatValue = $(object).val();
                this.addressViewDo();
            },
            __applyAddress: function (event) {
                event.preventDefault();
                this.addressViewDo();
            },
            balloonOpen: function (coords) {
                if(!this._map.balloon.isOpen()){
                    this._setPrice(coords);

                    $(".field_coordinate_delivery").val(coords);
                    this._balloon = this._map.balloon.open(coords, {
                        contentBody:  this._addressPointBalloonContent
                    });
                    this.addressViewDo();
                }
            },
            addressViewDo: function () {
                var __address = $('#js-order-adress-map-input').val();
                this.contentSave = __address + (this.flatValue.length ? ", кв. " + this.flatValue : "");
                $("#address-view").html(this.contentSave);
                $("#address-save").val(this.contentSave);
            },

            /**
             * Получаем координаты маркера и вызываем геокодер для точки.
             */
            _onAddressDragEnd: function () {
                var coords = this._addressPoint.geometry.getCoordinates();
                this.setPoint(coords);
            },

            /**
             * Создаем маршрут.
             * @param {Number[]|String} startPoint Координаты точки или адрес.
             * @param {Number[]|String} finishPoint Координаты точки или адрес.
             */
            setRoute: function (startPoint, finishPoint) {
                if (!this._addressPoint) {
                    this._addNewPoint(finishPoint);
                }
                if (typeof(finishPoint) === "string") {
                    vow.all([this._reverseGeocode(startPoint), this._geocode(finishPoint)]).then(function (res) {
                        this._setPointData(startPoint, res[0]);
                        this._setPointData(res[1][0], res[1][1]);
                        this._setupRoute();
                    }, this);
                } else {
                    vow.all([this._reverseGeocode(startPoint), this._reverseGeocode(finishPoint)]).then(function (res) {
                        this._setPointData(startPoint, res[0]);
                        this._setPointData(finishPoint, res[1]);
                        this._setupRoute();
                    }, this);

                }
            }
        });

        provide(AddressDelivery);
    }
);