/***********************************************************************/
// Global namespace wrapper
// Content of game.js
var Game = {

};
/***********************************************************************/
// Display object
// Content of display.js
Game.Display = function (width, height, tileWidth, tileHeight, sheet) {
	this.width = width;
	this.height = height;
	this.tileWidth = tileWidth;
	this.tileHeight = tileHeight;
	this.sheet = sheet;
	var canvas = document.createElement("canvas");
	this._context = canvas.getContext("2d");
	this._context.canvas.width = this.width * this.tileWidth;
	this._context.canvas.height = this.height * this.tileHeight;
	this.clear();
};

Game.Display.prototype.getContainer = function () {
	return this._context.canvas;
};

Game.Display.prototype.drawTile = function (x, y, tile, frame, clear) {
	if (clear) this.clearTile(x, y);
	this._context.drawImage(this.sheet, (frame * this.tileWidth), (tile * this.tileHeight), this.tileWidth, this.tileHeight, (x * this.tileWidth), (y * this.tileHeight), this.tileWidth, this.tileHeight);
};

Game.Display.prototype.drawBlock = function (x, y, w, h, color) {
	this._context.fillStyle = color;
	this._context.fillRect((x * this.tileWidth), (y * this.tileHeight), (w * this.tileWidth), (h * this.tileHeight));
};

Game.Display.prototype.clear = function () {
	this._context.fillStyle = '#000000';
	this._context.fillRect(0, 0, this.width * this.tileWidth, this.height * this.tileHeight);
};

Game.Display.prototype.clearTile = function (x, y) {
	this.drawBlock(x, y, 1, 1, "#000000");
};

/***********************************************************************/
// Engine object
// Content of engine.js
Game.Engine = function (size, width, height) {
	this.tileSize = size;
	this.width = width;
	this.height = height;
	this._qeue = [];
	this._lock = 1;
};

Game.Engine.prototype.init = function (spriteSheet) {
	this.display = new Game.Display(this.width, this.height, this.tileSize, this.tileSize, spriteSheet);
	this.map = new Game.Map(this, this.display, this.width, this.height);
	this.add(this.map);
	document.body.appendChild(this.display.getContainer());
	
};

Game.Engine.prototype.loadLevel = function (level) {
	this.map.clear();
	// Hand level the map reference.
	level.load(this.map);
};

Game.Engine.prototype.start = function () {
	this.unlock();
};

Game.Engine.prototype.lock = function () {
	this._lock++;
	return this;
};

Game.Engine.prototype.unlock = function () {
	this._lock--;
	while (!this._lock) {
		var actor = this._next();
		if (!actor) {
			return this.lock();
		}
		var result = actor.act();
		if (result && result.then) { // Returned thenable function, Promise
			this.lock(); // Lock for now
			result.then(this.unlock.bind(this)); // And bind promise for unlocking
		}
	}
	return this;
};

Game.Engine.prototype.add = function(actor) {
	if(!actor.act) throw "Not a valid actor";
	this._qeue.push(actor);
}

Game.Engine.prototype._next = function() {
	var current = this._qeue.pop();
	this._qeue.unshift(current);
	return current;
};

Game.Engine.prototype.clear = function() {
	this._qeue = [];
}

/***********************************************************************/
// Map object
// Content of map.js
Game.Map = function (game, display, width, height) {
	this._game = game;
	this._display = display;
	this._objectDefs = [];
	this._objects = [[]];
	this._dynamics = [];
	this._player = null;
	this._width = width;
	this._height = height;
};

/**
 * Add object definition
 */
Game.Map.prototype.defineObject = function (name, props) {
	if (this._objectDefs[name]) {
		throw "There is already a type of object named " + name + "!";
	}
	this._objectDefs[name] = props;
};

Game.Map.prototype.addDynamic = function(nx, ny, type) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (!this._objectDefs[type])
		throw "There is no type of object named " + type + "!";
	var actor = new Game.DynamicObject(type, x, y, this._game, this);
	this._dynamics.push( actor );
}

Game.Map.prototype.placeObject = function (nx, ny, type) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (!this._objectDefs[type])
		throw "There is no type of object named " + type + "!";
	if ( x == this.getPlayerX() && y == this.getPlayerY() ) throw "Cell occupied by a player!";
	if (typeof(this._objects[x]) === 'undefined') { // Row not instanced yet
		this._objects[x] = [];
		this._objects[x][y] = type;
	} else if (typeof(this._objects[x][y]) === 'undefined') { // Cell empty
		this._objects[x][y] = type;
	} else { // Cell Is full
		throw "Cell " + x +":"+ y + " is already full!";
	}
};

Game.Map.prototype.destroyObject = function(nx, ny) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
}

Game.Map.prototype.placePlayer = function (nx, ny, tile) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (this._player){
		throw "Player already in place!";
	} else {
		this._player = new Game.Player(x, y, tile, this, this._game);
		this._game.add(this._player);
	}
};

Game.Map.prototype.getPlayerX = function() {
	if (this._player) { return this._player._x; };
}

Game.Map.prototype.getPlayerY = function() {
	if (this._player) { return this._player._y; };
}

Game.Map.prototype.getDefinition = function(type) {
	return this._objectDefs[type];
}

// Redraw the whole map
Game.Map.prototype.draw = function() {
	this._display.clear();
	for (var row in this._objects) {
		for (var coll in this._objects[row]) {
			var objectDef = this._objectDefs[this._objects[row][coll]];
			if ( objectDef.tile ) { 
			}
			else if( objectDef.color ) { 
				this._display.drawBlock( row , coll , 1, 1, objectDef.color);
			}
		};
	};
	for (key in this._dynamics) {
		if (this._dynamics[key].tile) {
			var curr = this._dynamics[key];
			this._display.drawTile( curr.getX(), curr.getY(), curr.getTile(), curr.getFrame(), false );
		};
	};
	if (this._player) {this._display.drawTile( this._player.getX(), this._player.getY(), this._player.getTile(), this._player.getFrame(), true );};
}

Game.Map.prototype.canMoveTo = function(nx, ny, type) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (x >= this._width || y >= this._height || x < 0 || y < 0 ) {return false};
	// Check dynamics first
	for(key in this._dynamics) { if (this._dynamics[key].getX == x &&  this._dynamics[key].getY == y) {return false; }; };
	if (typeof(this._objects[x]) === 'undefined') { // Row not instanced yet
		return true;
	} else if (typeof(this._objects[x][y]) === 'undefined') { // Cell empty
		return true;
	} else { // Cell Is occupied
		if( this._objectDefs[ this._objects[x][y] ].impassable  ) return false;
		else return true;
	}
}

Game.Map.prototype.getObjectOn = function(nx, ny) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
}

Game.Map.prototype.playerMoveTo = function(nx, ny) {

}

Game.Map.prototype.checkDynamicCollision = function() {

}

Game.Map.prototype.act = function() {

	this.draw();
};
/***********************************************************************/
// Dynamic object
// Content of dynamic.js
Game.DynamicObject = function (type, x, y, game, map) {
	this._game = game;
	this._map = map;
	this._type = type;
	this._x = x;
	this._y = y;
	this._def = map.getDefinition(type);
	this.tile = this._def.tile;
}

Game.DynamicObject.prototype.getTile = function() {
	return this.tile;
}

Game.DynamicObject.prototype.getFrame = function() {
	return 0;
}

Game.DynamicObject.prototype.act = function() {
	if (this._def.turn)
		this._def.turn();
};

Game.DynamicObject.prototype.getX = function() {
	return this._x;
};

Game.DynamicObject.prototype.getY = function() {
	return this._y;
};

Game.DynamicObject.prototype.move = function(direction) {
	
};

/***********************************************************************/
// Player object
// Content of player.js
Game.Player = function (x, y, tile, map, game) {
	this._x = x;
	this._y = y;
	this._game = game;
	this._map = map;
	this.tile = tile;
	this._dir = 0;
	this._keyMap = {};
	this._keyMap[37] = 2; // LEFT
	this._keyMap[38] = 4; // UP
	this._keyMap[39] = 0; // RIGHT
	this._keyMap[40] = 6; // DOWN
};

Game.Player.prototype.act = function() {
	window.addEventListener("keydown", this);
	this._game.lock();
};

Game.Player.prototype.getY = function() {
	return this._y
};

Game.Player.prototype.getX = function() {
	return this._x
};

Game.Player.prototype.getTile = function() {
	return this.tile;
}

Game.Player.prototype.getFrame = function() {
	return this._dir;
}

Game.Player.prototype.move = function(direction) {

};

Game.Player.prototype.handleEvent = function(e) {
	var code = e.keyCode;

	if (!(code in this._keyMap)) { return; }
	var newX = this._x;
	var newY = this._y;
	switch(code) {
		case 37: newX--; break;
		case 38: newY--; break;
		case 39: newX++; break;
		case 40: newY++; break;
	}

	if (!this._map.canMoveTo(newX, newY, 'player')) { return; };
	this._map.playerMoveTo(newX, newY);
	
	this._x = newX;
	this._y = newY;
	this._dir = this._keyMap[code] ;
	
	window.removeEventListener("keydown", this);
	this._game.unlock();
}
