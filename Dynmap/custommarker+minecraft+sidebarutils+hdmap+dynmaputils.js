L.CustomMarker = L.Marker.extend({
	
	options: {
		elementCreator: undefined,
		shadowCreator: undefined,
		clickable: true,
		draggable: false
	},
	
	initialize: function(latlng, options) {
		//Dynmap - Pass options to CustomIcon
		options.icon = new L.CustomIcon(options);

		L.Util.setOptions(this, options);
		this._latlng = latlng;
	},
});

L.CustomIcon = L.DivIcon.extend({
	options: {
		elementCreator: function() {
			return document.createElement('div');
		},
		shadowCreator: function() { },
		className: '', //Remove divIcon class
	},

	initialize: function(options) {
		L.Util.setOptions(this, options);
	},

	createIcon() {
		//Call elementCreator to create icon
		var icon = this.options.elementCreator(),
			className = icon.className;

		icon.className += ' leaflet-marker-icon'; //Required for correct styling

		return icon;
	},

	createShadow() {
		return this.options.shadowCreator();
	}
});




function createMinecraftHead(player,size,completed,failed) {
	var faceImage = new Image();
	faceImage.onload = function() {
		completed(faceImage);
	};
	faceImage.onerror = function() {
		failed();
	};
	var faceimg;
	if(size == 'body')
		faceimg = 'faces/body/' + encodeURIComponent(player) + '.png';
	else
		faceimg = 'faces/' + size + 'x' + size + '/' + encodeURIComponent(player) + '.png';
	
	faceImage.src = concatURL(dynmap.options.url.markers, faceimg);
}

function getMinecraftHead(player,size,completed) {
	createMinecraftHead(player, size, completed, function() {
		console.error('Failed to retrieve face of "', player, '" with size "', size, '"!')
	});
}

function getMinecraftTime(servertime) {
	servertime = parseInt(servertime);
	var day = servertime >= 0 && servertime < 13700;
	return {
		servertime: servertime,
		days: parseInt((servertime+8000) / 24000),
		
		// Assuming it is day at 6:00
		hours: (parseInt(servertime / 1000)+6) % 24,
		minutes: parseInt(((servertime / 1000) % 1) * 60),
		seconds: parseInt(((((servertime / 1000) % 1) * 60) % 1) * 60),
		
		day: day,
		night: !day
	};
}

function chat_encoder(message) {
    if (dynmap.options.cyrillic) {
    	if(message.source === 'player') {
        	var utftext = "";
        	for (var n = 0; n < message.text.length; n++) {
	        	var c = message.text.charCodeAt(n);
            	if (c >= 192) {
            	var c = message.text.charCodeAt(n);
                	utftext += String.fromCharCode(c+848);
            	}
            	else if (c == 184) { utftext += String.fromCharCode(1105); }
            	else {
                	utftext += String.fromCharCode(c);
            	}
        	}
        	return utftext
	    }
    }
    return message.text;
}




var SidebarUtils = {
	createSection: function (labelText, content) {
		var legend = $('<legend/>').text(labelText);
		var upBtn = SidebarUtils.createScrollButton(true, content);
		var downBtn = SidebarUtils.createScrollButton(false, content);
		
		var section = $('<fieldset/>')
			.addClass('section')
			.append(legend)
			.append(upBtn)
			.append(
				content
					.addClass('content')
					.bind('mousewheel', function(event, delta){
						this.scrollTop -= (delta * 10);
						event.preventDefault();
					})
			)
			.append(downBtn);
		
		return {
			section: section,
			legend: legend,
			upBtn: upBtn,
			content: content,
			downBtn: downBtn
		};
	},
	
	createListSection: function (labelText) {
		var content = $('<ul/>').addClass('list');
		return SidebarUtils.createSection(labelText, content);
	},
	
	createScrollButton: function (up, target) {
		var cls = up ? 'scrollup' : 'scrolldown';
		var amount = (up ? '-' : '+') + '=300px';
		
		return $('<div/>')
			.addClass(cls)
			.bind('mousedown mouseup touchstart touchend', function (event) {
		    	if (event.type == 'mousedown' || event.type == 'touchstart') {
					target.animate({"scrollTop": amount}, 3000, 'linear');
		    	} else {
		        	target.stop();
		    	}
			});
	}
};




var HDProjection = DynmapProjection.extend({
	fromLocationToLatLng: function(location) {
		var wtp = this.options.worldtomap;
			lat = wtp[3] * location.x + wtp[4] * location.y + wtp[5] * location.z,
			lng = wtp[0] * location.x + wtp[1] * location.y + wtp[2] * location.z;

		return new L.LatLng(
			  -((128 - lat) / (1 << this.options.mapzoomout))
			, lng / (1 << this.options.mapzoomout)
			, location.y);
	},
	fromLatLngToLocation: function(latlon, y) {
		var ptw = this.options.maptoworld,
			lat = 128 + latlon.lat * (1 << this.options.mapzoomout),
			lng = latlon.lng * (1 << this.options.mapzoomout),
			x = ptw[0] * lng + ptw[1] * lat + ptw[2] * y,
			z = ptw[6] * lng + ptw[7] * lat + ptw[8] * y;
		
		return { x: x, y: y, z: z };
	}
});

var HDMapType = DynmapTileLayer.extend({
	projection: undefined,
	options: {
		minZoom: 0,
		errorTileUrl: 'images/blank.png',
		tileSize: 128,
		zoomReverse: true,
	},
	initialize: function(options) {
		options.maxZoom = options.mapzoomin + options.mapzoomout;
		options.maxNativeZoom = options.mapzoomout;

		this.projection = new HDProjection($.extend({map: this}, options));

		L.Util.setOptions(this, options);
		DynmapTileLayer.prototype.initialize.call(this, options);
	},
	getTileName: function(coords) {
		var info = this.getTileInfo(coords);
		// Y is inverted for HD-map.
		info.y = -info.y;
		info.scaledy = info.y >> 5;
		return namedReplace('{prefix}{nightday}/{scaledx}_{scaledy}/{zoom}{x}_{y}.{fmt}', info);
	},
	zoomprefix: function(amount) {
		// amount == 0 -> ''
		// amount == 1 -> 'z_'
		// amount == 2 -> 'zz_'
		return 'zzzzzzzzzzzzzzzzzzzzzz'.substr(0, amount) + (amount === 0 ? '' : '_');
	}
});

maptypes.HDMapType = function(options) { return new HDMapType(options); };




var DynmapProjection = L.Class.extend({
	initialize: function(options) {
		L.Util.setOptions(this, options);
	},
	fromLocationToLatLng: function(location) {
		throw "fromLocationToLatLng not implemented";
	},
	fromLatLngToLocation: function(location) {
		return null;
	}
});

if (!Array.prototype.indexOf) { // polyfill for IE < 9
	    Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
	        "use strict";
	        if (this === void 0 || this === null) {
	            throw new TypeError();
	        }
	        var t = Object(this);
	        var len = t.length >>> 0;
	        if (len === 0) {
	            return -1;
	        }
	        var n = 0;
	        if (arguments.length > 0) {
	            n = Number(arguments[1]);
	            if (n !== n) { // shortcut for verifying if it's NaN
	                n = 0;
	            } else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0)) {
	                n = (n > 0 || -1) * Math.floor(Math.abs(n));
	            }
	        }
	        if (n >= len) {
	            return -1;
	        }
	        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
	        for (; k < len; k++) {
	            if (k in t && t[k] === searchElement) {
	                return k;
	            }
	        }
	        return -1;
	    }
}

var DynmapLayerControl = L.Control.Layers.extend({
	getPosition: function() {
		return 'topleft';
	},
	
	// Function override to include pos
	addOverlay: function(layer, name, pos) {
		this._addLayer(layer, name, true, pos);
		this._update();
		return this;
	},
	
	// Function override to order layers by pos
	_addLayer: function (layer, name, overlay, pos) {
		var id = L.stamp(layer);

		this._layers[pos] = {
			layer: layer,
			name: name,
			overlay: overlay,
			id: id
		};

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}
	}
});


var DynmapTileLayer = L.TileLayer.extend({
	_namedTiles: null,
	_cachedTileUrls: null,
	_loadQueue: null,
	_loadingTiles: null,

	initialize: function() {
		this._namedTiles = {};
		this._cachedTileUrls = {};
		this._loadQueue = [];
		this._loadingTiles = [];
	},

	createTile: function(coords, done) {
		var me = this,
			tile = document.createElement('img');

  		if (this.options.crossOrigin || this.options.crossOrigin === '') {
  			tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
  		}

  		tile.alt = '';
  		tile.setAttribute('role', 'presentation');

  		//Dynmap - Tile names
  		tile.tileName = this.getTileName(coords);
  		this._namedTiles[tile.tileName] = tile;

		tile.onload = function() {
			me._tileOnLoad(done, tile);

			//Dynmap - Update load queue
			me._loadingTiles.splice(me._loadingTiles.indexOf(tile), 1);
			me._tickLoadQueue();
		};

		tile.onerror = function() {
			me._tileOnError(done, tile);

			//Dynmap - Update load queue
			me._loadingTiles.splice(me._loadingTiles.indexOf(tile), 1);
			me._tickLoadQueue();
		};

		//Dynmap - Queue for loading
		tile.url = this.getTileUrl(coords);
		this._loadQueue.push(tile);
		this._tickLoadQueue();

		return tile;
	},

	_abortLoading: function() {
		var tile;

		for (var i in this._tiles) {
			if (!Object.prototype.hasOwnProperty.call(this._tiles, i)) {
				continue;
			}

			tile = this._tiles[i];

			//Dynmap - remove namedTiles entry
			if (tile.coords.z !== this._tileZoom) {
				if (tile.loaded && tile.el && tile.el.tileName) {
					delete this._namedTiles[tile.el.tileName];
				}

				if(this._loadQueue.indexOf(tile.el) > -1) {
					this._loadQueue.splice(this._loadQueue.indexOf(tile.el), 1);
				}

				if(this._loadingTiles.indexOf(tile.el) > -1) {
					this._loadingTiles.splice(this._loadingTiles.indexOf(tile.el), 1);
				}
			}
		}

		L.TileLayer.prototype._abortLoading.call(this);
	},

	_removeTile: function(key) {
		var tile = this._tiles[key];

		if (!tile) {
			return;
		}

		//Dynmap - remove namedTiles entry
		var tileName = tile.el.tileName;

		if (tileName) {
			delete this._namedTiles[tileName];
		}

		//Dynmap - remove from load queue
		if(this._loadingTiles.indexOf(tile.el) > -1) {
			this._loadingTiles.splice(this._loadingTiles.indexOf(tile.el), 1);
		}

		if(this._loadQueue.indexOf(tile.el) > -1) {
			this._loadQueue.splice(this._loadQueue.indexOf(tile.el), 1);
		}

		tile.el.onerror = null;
		tile.el.onload = null;

		L.TileLayer.prototype._removeTile.call(this, key);
	},

	getTileUrl: function(coords, timestamp) {
		return this.getTileUrlFromName(this.getTileName(coords), timestamp);
	},

	getTileUrlFromName(tileName, timestamp) {
		var url = this._cachedTileUrls[tileName];

		if (!url) {
			this._cachedTileUrls[tileName] = url = this.options.dynmap.getTileUrl(tileName);
		}

		if(typeof timestamp !== 'undefined') {
			url += (url.indexOf('?') === -1 ? '?timestamp=' + timestamp : '&timestamp=' + timestamp);
		}

		return url;
	},

	getProjection: function() {
		return this.projection;
	},

	_tickLoadQueue: function() {
		if (this._loadingTiles.length > 4) {
			return;
		}

		var next = this._loadQueue.shift();

		if (!next) {
			return;
		}

		this._loadingTiles.push(next);
		next.src = next.url;
	},

	getTileName: function(coords) {
		throw "getTileName not implemented";
	},

	updateNamedTile: function(name, timestamp) {
		var tile = this._namedTiles[name];

		if (tile) {
			tile.url = this.getTileUrlFromName(name, timestamp);
			this._loadQueue.push(tile);
			this._tickLoadQueue();
		}
	},

	// Some helper functions.
	zoomprefix: function(amount) {
		return 'zzzzzzzzzzzzzzzzzzzzzz'.substr(0, amount);
	},

	getTileInfo: function(coords) {
		// zoom: max zoomed in = this.options.maxZoom, max zoomed out = 0
		// izoom: max zoomed in = 0, max zoomed out = this.options.maxZoom
		// zoomoutlevel: izoom < mapzoomin -> 0, else -> izoom - mapzoomin (which ranges from 0 till mapzoomout)
		var izoom = this._getZoomForUrl(),
			zoomoutlevel = Math.max(0, izoom - this.options.mapzoomin),
			scale = 1 << zoomoutlevel,
			x = scale * coords.x,
			y = scale * coords.y;

		return {
			prefix: this.options.prefix,
			nightday: (this.options.nightandday && this.options.dynmap.serverday) ? '_day' : '',
			scaledx: x >> 5,
			scaledy: y >> 5,
			zoom: this.zoomprefix(zoomoutlevel),
			zoomprefix: (zoomoutlevel==0)?"":(this.zoomprefix(zoomoutlevel)+"_"),
			x: x,
			y: y,
			fmt: this.options['image-format'] || 'png'
		};
	}
});

function loadjs(url, completed) {
	var script = document.createElement('script');
	script.setAttribute('src', url);
	script.setAttribute('type', 'text/javascript');
	var isloaded = false;
	script.onload = function() {
		if (isloaded) { return; }
		isloaded = true;
		completed();
	};

	// Hack for IE, don't know whether this still applies to IE9.
	script.onreadystatechange = function() {
		if (script.readyState == 'loaded' || script.readyState == 'complete')
			script.onload();
	};
	(document.head || document.getElementsByTagName('head')[0]).appendChild(script);
}

function loadcss(url, completed) {
	var link = document.createElement('link');
	link.setAttribute('href', url);
	link.setAttribute('rel', 'stylesheet');
	var isloaded = false;
	if (completed) {
		link.onload = function() {
			if (isloaded) { return; }
			isloaded = true;
			completed();
		};

		// Hack for IE, don't know whether this still applies to IE9.
		link.onreadystatechange = function() {
			link.onload();
		};
	}

	(document.head || document.getElementsByTagName('head')[0]).appendChild(link);
}

function splitArgs(s) {
	var r = s.split(' ');
	delete arguments[0];
	var obj = {};
	var index = 0;
	$.each(arguments, function(argumentIndex, argument) {
		if (!argumentIndex) { return; }
		var value = r[argumentIndex-1];
		obj[argument] = value;
	});
	return obj;
}

function swtch(value, options, defaultOption) {
	return (options[value] || defaultOption || function(){})(value);
}
(function( $ ){
	$.fn.scrollHeight = function(height) {
		return this[0].scrollHeight;
	};
})($);

function Location(world, x, y, z) {
	this.world = world;
	this.x = x;
	this.y = y;
	this.z = z;
}

function namedReplace(str, obj)
{
	var startIndex = 0;
	var result = '';
	while(true) {
		var variableBegin = str.indexOf('{', startIndex);
		var variableEnd = str.indexOf('}', variableBegin+1);
		if (variableBegin < 0 || variableEnd < 0) {
			result += str.substr(startIndex);
			break;
		}
		if (variableBegin < variableEnd) {
			var variableName = str.substring(variableBegin+1, variableEnd);
			result += str.substring(startIndex, variableBegin);
			result += obj[variableName];
		} else /* found '{}' */ {
			result += str.substring(startIndex, variableBegin-1);
			result += '';
		}
		startIndex = variableEnd+1;
	}
	return result;
}

function concatURL(base, addition) {
	if(base.indexOf('?') >= 0)
		return base + escape(addition);
	
	return base + addition;
}

