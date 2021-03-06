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

	// Create canvas
	var canvas = document.createElement("canvas");
	this._context = canvas.getContext("2d");
	this._context.canvas.width = this.width * this.tileWidth;
	this._context.canvas.height = this.height * this.tileHeight;
	this._context.textAlign="center";

	// Create noticeboard and position it
	this._noticeBoard = document.createElement("div");
	this._noticeBoard.setAttribute("id", "game-area-notice");
	this._noticeBoard.setAttribute("style", "width: "+this.width * this.tileWidth+"px; top: "+(this.height * this.tileHeight)/4+"px;");

	this.clear();
	this.hideNotice();
};

Game.Display.prototype.getContainer = function () {
	var frag = document.createDocumentFragment();
	frag.appendChild(this._context.canvas);
	frag.appendChild(this._noticeBoard);
	return frag;
};

Game.Display.prototype.drawTile = function (x, y, tile, frame, clear) {
	if (clear) this.clearTile(x, y);
	this._context.drawImage(this.sheet, (frame * this.tileWidth), (tile * this.tileHeight), this.tileWidth, this.tileHeight, (x * this.tileWidth), (y * this.tileHeight), this.tileWidth, this.tileHeight);
};

Game.Display.prototype.drawText = function(x, y, size, text) {
	this._context.font = this.tileWidth*size+"px Verdana";
	this._context.fillStyle = '#000000';
	var width = Math.ceil((this._context.measureText(text).width)/this.tileWidth);
	this.drawBlock(x-(width/2), y-size, width, 1, "#000000");
	this._context.fillStyle = '#FFFFFF';
	this._context.fillText(text, this.tileWidth*x, this.tileHeight*y);
}

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

Game.Display.prototype.showNotice = function( text ) {
	this._notice = true;
	this._noticeBoard.innerHTML = text;
	this._noticeBoard.style.visibility = "visible";
}

Game.Display.prototype.hideNotice = function() {
	this._notice = false;
	this._noticeBoard.innerHTML = "";
	this._noticeBoard.style.visibility = "hidden";
}
/***********************************************************************/
// Engine object
// Content of engine.js
Game.Engine = function (size, width, height, container) {
	this.tileSize = size;
	this.width = width;
	this.height = height;
	this._qeue = [];
	this._levels = [];
	this._level = 0;
	this._lock = 1;
	this._running = false;
	this.display;
	this.map;
	this._refresher;
	this._framecounter = 0;
	this._container = container
};

Game.Engine.prototype.init = function (levels, spriteSheet) {
	this._levels = levels;
	this.display = new Game.Display(this.width, this.height, this.tileSize, this.tileSize, spriteSheet);
	this.map = new Game.Map(this, this.display, this.width, this.height);
	this._container.appendChild(this.display.getContainer());

};

Game.Engine.prototype.loadLevel = function (index) {
	this.map.clear();
	if (index >= this._levels.length) {
		return false;
	};
	// Hand level the map reference.
	this._levels[index].load(this.map);
	return true;
};

Game.Engine.prototype.start = function () {
	if(this.loadLevel(this._level))
	{
		this.add(this.map);
		this.add(new Game.Engine.Timer(150, this));
		this._level++;
		this._refresher = window.setInterval(this.refresh.bind(this), (1000/30) );
		window.addEventListener("keydown", this.map._player);
		this._running = true;
		this.unlock();
	}
};

Game.Engine.prototype.stop = function () {
	this.lock();
	window.removeEventListener("keydown", this.map._player);
	window.clearInterval(this._refresher);
	this.clear();
	this._running = false;
};

Game.Engine.prototype.checkMap = function () {
	if (! this._running ) { return; };
	if ( this._levels[this._level-1].checkVictory(this.map) ) {
		this.display.showNotice("All cakes on map have been nomed!</br>You ended up with score of: "+this.map.getPlayer().getScore()+" points.");
		this.stop();
	};
};

Game.Engine.prototype.refresh = function() {
	if ( this._framecounter == 6 ) { this._framecounter = 0; };
	this.map.draw( this._framecounter == 0 );
	this._framecounter++;
};

////////////////////
// Scheduler code //
////////////////////
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
	this._width = width;
	this._height = height;
	this._objects = [];
	this._dirty = [];
	this._objectCount = [];
	this.clear();
};

// Clear Game state
Game.Map.prototype.clear = function() {
	for (var i = 0; i < this._width; i++) {
		this._objects[i] = [];
		this._dirty[i] = [];
	};
	this._objectCount = [];
	this._objectDefs = [];
	this._dynamics = [];
	this._player = null;
	this._foodCount = 0;
	this._started = false;
};

// Set scoreboard position and size
Game.Map.prototype.scoreBoard = function (x, y, size) {
	this._scoreX = x;
	this._scoreY = y;
	this._scoreSize = size;
};

/**
 * Add object definition
 */
Game.Map.prototype.defineObject = function (name, props) {
	if (this._objectDefs[name]) {
		throw "There is already a type of object named " + name + "!";
	}
	this._objectDefs[name] = props;
	this._objectCount[name] = 0;
};

// Get type count
Game.Map.prototype.getCount = function (type) {
	return this._objectCount[type];
};

// Add dynamic object to map
Game.Map.prototype.addDynamic = function(nx, ny, type) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (!this._objectDefs[type])
		throw "There is no type of object named " + type + "!";
	var actor = new Game.DynamicObject(type, x, y, this._game, this);
	this._dynamics.push( actor );
};

// Place a static object into the grid
Game.Map.prototype.placeObject = function (nx, ny, type) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (!this._objectDefs[type])
		throw "There is no type of object named " + type + "!";
	if ( x == this.getPlayerX() && y == this.getPlayerY() )
		throw "Cell occupied by a player!";

	if (typeof(this._objects[x][y]) === 'undefined') { // Cell empty
		this._objects[x][y] = type;
		this._dirty[x][y] = true;
		this._objectCount[type]++;
	} else { // Cell Is full
		throw "Cell " + x +":"+ y + " is already full!";
	}
};

// Destroy static object on given indices
Game.Map.prototype.destroyObject = function(nx, ny) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);

	if (typeof(this._objects[x]) !== 'undefined') { // Row is instanced
		if (typeof(this._objects[x][y]) !== 'undefined') { // Cell is not empty
			this._objectCount[ this._objects[x][y] ]--;
			delete this._objects[x][y];
			this._dirty[x][y] = true;
			return true;
		}
	}
	return false;
};

// Place player into the grid
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

// Player getter
Game.Map.prototype.getPlayer = function() {
	if (this._player) {return this._player;}
};

// Player X getter
Game.Map.prototype.getPlayerX = function() {
	if (this._player) { return this._player.getX(); };
};

// Player Y getter
Game.Map.prototype.getPlayerY = function() {
	if (this._player) { return this._player.getY(); };
};

// Object def getter
Game.Map.prototype.getDefinition = function(type) {
	return this._objectDefs[type];
};

// Redraw dirty parts of the map
Game.Map.prototype.draw = function( flip ) {
	var dirties = 0;
	for(var coll in this._dirty) {
		for(var row in this._dirty[coll]) {
			var objectDef = this._objectDefs[this._objects[coll][row]];
			delete this._dirty[coll][row];
			dirties++;
			if (typeof(objectDef) === 'undefined') {
				this._display.clearTile(coll, row);
				continue;
			};
			if ( objectDef.tile ) {
				if ( objectDef.frame ) {
					this._display.drawTile( coll, row, objectDef.tile, objectDef.frame, true );
				} else {
					this._display.drawTile( coll, row, objectDef.tile, 0, true );
				}
			}
			else if( objectDef.color ) {
				this._display.drawBlock( coll , row , 1, 1, objectDef.color);
			}
		}
	}
	if (this._player) {this._display.drawTile( this._player.getX(),
												this._player.getY(),
												this._player.getTile(),
												this._player.getFrame(flip),
												true );
						};
	
	for (key in this._dynamics) {
		var curr = this._dynamics[key];
		this._display.drawTile( curr.getX(), curr.getY(), curr.getTile(), curr.getFrame(flip), true );
	};

	if (this._scoreSize) {
		this._display.drawText(this._scoreX, this._scoreY, this._scoreSize, "Score:");
		this._display.drawText(this._scoreX, this._scoreY+this._scoreSize, this._scoreSize, this._player.getScore());
	};
};

// Check if object can move to given position
Game.Map.prototype.canMoveTo = function(nx, ny, type) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (x >= this._width || y >= this._height || x < 0 || y < 0 ) {return false};

	if (typeof(this._objects[x]) === 'undefined') { // Row not instanced yet
		return true;
	} else if (typeof(this._objects[x][y]) === 'undefined') { // Cell empty
		return true;
	} else { // Cell Is occupied
		if( this._objectDefs[ this._objects[x][y] ].impassable  ) return false;
		else return true;
	}
};

// Return object at given coordinates (No player)
Game.Map.prototype.getObjectOn = function(nx, ny) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	if (typeof(this._objects[x]) !== 'undefined') { // Row is instanced
		if (typeof(this._objects[x][y]) !== 'undefined') { // Cell is not empty
			return this._objectDefs[this._objects[x][y]]; // Return object def
		}
	}

	for (key in this._dynamics) {
		var curr = this._dynamics[key];
		if (curr.getX() == x && curr.getY() == y) {
			return curr;
		};
	};
};

// Player move checks
Game.Map.prototype.playerMoveTo = function(nx, ny) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	// Flag dirty block around player
	this._dirty[this._player.getX()][this._player.getY()] = true;
	this._dirty[x][y] = true;
	// Check dynamics collisions first
	for (key in this._dynamics) {
		var curr = this._dynamics[key];
		if (curr.getX() == x && curr.getY() == y) {
			return curr.onCollision(this._player);
		};
	};
	if (typeof(this._objects[x][y]) !== 'undefined') { // Cell is not empty
		if ( this._objectDefs[this._objects[x][y]].onCollision ) {
			this._objectDefs[this._objects[x][y]].onCollision({x:x, y:y}, this._player);
		};
	};

	this._started = true;
	return true;
};

// Is there a dynamic object at given coordinates?
Game.Map.prototype.checkForDynamic = function(nx, ny) {
	var x = Math.floor(nx);
	var y = Math.floor(ny);
	for (key in this._dynamics) {
		var curr = this._dynamics[key];
		if (curr.getX() == x && curr.getY() == y) {
			return true;
		};
	};
};

Game.Map.prototype.playerKilled = function(killer) {
	this._display.showNotice("You have been caught by: "+killer+"!</br>Your score is: "+this._player.getScore()+" point.");
	//this.draw(false);
	this._game.stop();
};

// Map turn.
// Move all pieces and do a flip redraw
Game.Map.prototype.act = function() {
	if(this._started === false) {
		if (!this._display._notice) {this._display.showNotice("Start the game by moving.</br>Use arrows to move around.");};
		return;
	};
	if (this._display._notice) {this._display.hideNotice();};
	this._game.checkMap();
	for(key in this._dynamics) {
		this._dirty[this._dynamics[key].getX()][this._dynamics[key].getY()] = true;
		this._dynamics[key].act();
		this._dirty[this._dynamics[key].getX()][this._dynamics[key].getY()] = true;
	};
	//this.draw(true);
};
Game.Engine.Timer = function (time, game) {
	this._game = game;
	this._time = time;
};

Game.Engine.Timer.prototype.act = function() {
	this._game.lock();
	var seconds = new Date().getTime() / 1000;
	window.setTimeout(this.timeout.bind(this), this._time);
};

Game.Engine.Timer.prototype.timeout = function() {
	this._game.unlock();
};Game.Level01 = {
	load: function(map) {
		map.defineObject("block", Game.Map.Wall);
		map.defineObject("blinky", new Game.Map.Ghost(1, "Blinky"));
		map.defineObject("pinky", new Game.Map.Ghost(2, "Pinky"));
		map.defineObject("inky", new Game.Map.Ghost(3, "Inky"));
		map.defineObject("clyde", new Game.Map.Ghost(4, "Clyde"));
		map.defineObject("food", Game.Map.Food );
		map.scoreBoard(21,13,1);
		Game.Level01.buildMaze(map, this.Walls);

	},

	checkVictory: function(map) {
		if (map.getCount('food') == 0) { return true; };
		return false;
	},

	checkDefeat: function(map) {
		return true;
	},

	buildMaze: function(map, Walls) {
		for (var y = 0; y < Walls.length; y++) {
			for (var x = 0; x < Walls[y].length; x++) {
				switch( Walls[y][x] ) {
					case 'W': map.placeObject(x, y, 'block');
						break;
					case '*': map.placeObject(x, y, 'food');
						break;
					case 'P': map.addDynamic(x, y, "pinky");
						break;
					case 'B': map.addDynamic(x, y, "blinky");
						break;
					case 'I' : map.addDynamic(x, y, "inky");
						break;
					case 'C' : map.addDynamic(x, y, "clyde");
						break;
					case 'O' : map.placePlayer(x, y, 0);
								//map.placeObject(x+1, y, 'food');
						break;
				}
			};
		};
	},

	Walls: [
		'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
		'WWW***********************************____***********************************WWW',
		'WWW*WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW__O_WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW*WWW',
		'W*************************************____*************************************W',
		'W*W*WWWWWWWWWWWWWWWWW_WWWWWWWWWWWWWWWW_WW_WWWWWWWWWWWWWWWW_WWWWWWWWWWWWWWWWW*W*W',
		'W*W*WW*******************************W_WW_W*******************************WW*W*W',
		'W*W*WW*WWWWWWWWWWWWWWWWWWWWWWWWWWWWW*W_WW_W*WWWWWWWWWWWWWWWWWWWWWWWWWWWWW*WW*W*W',
		'W*W*WW*WW*************************WW*W_WW_W*WW*************************WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W_WW_W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W_WW_W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WW___________________WW*WW*W_WW_W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WW___________________WW*WW*W_WW_W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WW___________________WW*WW*W_WW_W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WW___________________WW*WW*W****W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*__*WW___________________WW*WW*WWWWWW*WW*WWWWWWWWWWWWWWWWWWWWWWW*__*WW*W*W',
		'W*W*WW*WW*WW___________________WW*WW********WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WWWW_WW_WWWW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WWWW_WW_WWWW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW**************************************************************WW*WW*W*W',
		'W*W*__*WWWWW_WWWWWWWWWWWWWWWWWWWWWWWWW_PI_WWWWWWWWWWWWWWWWWWWWWWWWW_WWWWW*__*W*W',
		'W*W*WW*WWWWW_WWWWWWWWWWWWWWWWWWWWWWWWW_CB_WWWWWWWWWWWWWWWWWWWWWWWWW_WWWWW*WW*W*W',
		'W*W*WW*WW**************************************************************WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WWWW_WW_WWWW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WWWW_WW_WWWW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW********WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*__*WWWWWWWWWWWWWWWWWWWWWWW*WW*WWWWWW*WW*WWWWWWWWWWWWWWWWWWWWWWW*__*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W****W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W*WW*W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W*WW*W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W*WW*W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W*WW*W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*W*WW*W*WW*WWWWWWWWWWWWWWWWWWWWWWW*WW*WW*W*W',
		'W*W*WW*WW*************************WW*W*WW*W*WW*************************WW*WW*W*W',
		'W*W*WW*WWWWWWWWWWWWWWWWWWWWWWWWWWWWW*W*WW*W*WWWWWWWWWWWWWWWWWWWWWWWWWWWWW*WW*W*W',
		'W*W*WW*******************************W*WW*W*******************************WW*W*W',
		'W*W*WWWWWWWWWWWWWWWWW_WWWWWWWWWWWWWWWW*WW*WWWWWWWWWWWWWWWW_WWWWWWWWWWWWWWWWW*W*W',
		'W**************************************WW**************************************W',
		'WWW*WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW****WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW*WWW',
		'WWW************************************WW************************************WWW',
		'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW'
	]
}/***********************************************************************/
// Dynamic object
// Content of dynamic.js
Game.DynamicObject = function (type, x, y, game, map) {
	this._game = game;
	this._map = map;
	this._type = type;
	this._x = x;
	this._y = y;
	this._def = map.getDefinition(type);
}

Game.DynamicObject.prototype.getTile = function() {
	if (this._def.getTile) { return this._def.getTile(); }
	else return this._def.tile;
}

Game.DynamicObject.prototype.getFrame = function(flip) {
	if ( this._def.getFrame ) { return this._def.getFrame(flip) };
	return 0;
}

Game.DynamicObject.prototype.act = function() {
	if (this._def.turn)
		this._def.turn(this, this._map);
};

Game.DynamicObject.prototype.getX = function() {
	return this._x;
};

Game.DynamicObject.prototype.getY = function() {
	return this._y;
};

Game.DynamicObject.prototype.canMove = function( direction ) {
	switch(direction) {
		case 2: return this._map.canMoveTo( this._x-1, this._y ) && !this._map.checkForDynamic( this._x-1, this._y );
			break;
		case 0: return this._map.canMoveTo( this._x+1, this._y ) && !this._map.checkForDynamic( this._x+1, this._y );
			break;
		case 4: return this._map.canMoveTo( this._x, this._y-1 ) && !this._map.checkForDynamic( this._x, this._y-1 );
			break;
		case 6: return this._map.canMoveTo( this._x, this._y+1 ) && !this._map.checkForDynamic( this._x, this._y+1 );
			break;
	}
}

Game.DynamicObject.prototype.move = function(direction) {
	var newX = this._x; var newY = this._y;
	switch(direction) {
		case 2: newX--;
			break;
		case 0: newX++;
			break;
		case 4: newY--;
			break;
		case 6: newY++;
			break;
	}

	// Check if player is on new indices
	if ( this._map.getPlayerX() == newX && this._map.getPlayerY() == newY ) {
		this.onCollision(this._map.getPlayer());
	} else {
		this._x = newX;
		this._y = newY;
	}
};

Game.DynamicObject.prototype.onCollision = function(player) {
	if (this._def.onCollision) {
		return this._def.onCollision(this, player);
	} else {
		return true;
	}
}
Game.Map.Food = {
	tile: 5,
	frame: 1,
	value: 10,
	onCollision: function(me, player) {
		me.value = this.value;
		player.nom(me);
		return true;
	}
};Game.Map.Ghost = function(tile, name) {
	this.dynamic = true;
	this.impassable = true;
	this.name = name;
	this.tile = tile;
	this._animation = 0;
	this._brain = [2, 0, 6, 4];
	this._dir = this._brain[0];
};

Game.Map.Ghost.prototype.turn = function(me, map){

	var dirs = [];
	for (var i = 0; i < this._brain.length; i++) {
		if (me.canMove(this._brain[i])) {
			dirs.push(this._brain[i]);
		}
	};
	dirs = this.shuffle(dirs);
	if (dirs.length == 3 ) {
		me.move(dirs[0]);
		this._dir = dirs[0];
	} else if ( dirs.indexOf(this._dir) > -1 ) {
		me.move( this._dir );
	} else if ( dirs.length > 0 ) {
		me.move(dirs[0]);
		this._dir = dirs[0];
	}
};

Game.Map.Ghost.prototype.onCollision = function(me, player) {
	player.killedBy(this.name+" the ghost");
	return true;
}

Game.Map.Ghost.prototype.getFrame = function(flip) {
	var frame = this._animation;
	if(flip){
		if (this._animation == 0) { this._animation++;}
		else {this._animation = 0; }
	}
	return this._dir+frame;
};

Game.Map.Ghost.prototype.shuffle = function(array) {
    var tmp, current, top = array.length;

    if(top) while(--top) {
    	current = Math.floor(Math.random() * (top + 1));
    	tmp = array[current];
    	array[current] = array[top];
    	array[top] = tmp;
    }

    return array;
}/***********************************************************************/
// Player object
// Content of player.js
Game.Player = function (x, y, tile, map, game) {
	this._x = x;
	this._y = y;
	this.killed = false;
	this._game = game;
	this._map = map;
	this._score = 0;
	this.tile = tile;
	this._dir = 0;
	this._animation = 0;
	this._keyMap = {};
	this._keyMap[37] = 2; // LEFT
	this._keyMap[38] = 4; // UP
	this._keyMap[39] = 0; // RIGHT
	this._keyMap[40] = 6; // DOWN
	this._myTurn = false;
};

Game.Player.prototype.act = function() {
	this._myTurn = true;
};

Game.Player.prototype.killedBy = function(killer) {
	//this._game.lock();
	this.killed = true;
	this._map.playerKilled(killer);
};

Game.Player.prototype.nom = function ( food ) {
	this._score+=food.value;
	this._map.destroyObject(food.x, food.y);
};

Game.Player.prototype.getScore = function() {
	return this._score;
}

Game.Player.prototype.getY = function() {
	return this._y
};

Game.Player.prototype.getX = function() {
	return this._x
};

Game.Player.prototype.getTile = function() {
	return this.tile;
};

Game.Player.prototype.getFrame = function(flip) {
	var frame = this._animation;
	if(flip){
		if (this._animation == 0) { this._animation++;}
		else {this._animation = 0; }
	}
	return this._dir+frame;
};

Game.Player.prototype.move = function(newX, newY) {

	if (!this._map.canMoveTo(newX, newY, 'player')) { return false; };
	if (this._map.playerMoveTo(newX, newY)) {
		this._x = newX;
		this._y = newY;
		return true;
	}

	return false;
};

Game.Player.prototype.handleEvent = function(e) {
	var code = e.keyCode;
	if(!this._myTurn) { return; }
	if (!(code in this._keyMap)) { return; }
	var newX = this._x;
	var newY = this._y;
	switch(code) {
		case 37: newX--; break;
		case 38: newY--; break;
		case 39: newX++; break;
		case 40: newY++; break;
	}

	if (this.move(newX, newY)) {
		this._dir = this._keyMap[code] ;
		this._map.draw(false); // Non flip call
		this._myTurn = false;
	};
};
Game.Map.Wall = {
	impassable:true ,
//	tile: 5,
//	frame: 0,
	color: "#666666"
};
