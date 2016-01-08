'use strict'

const GAME_WIDTH = 1280
const GAME_WIDTH_PADDING = 16
const GAME_HEIGHT = 640
const GAME_HEIGHT_PADDING = 26

var app = require('app')  // Module to control application life.
var BrowserWindow = require('browser-window')  // Module to create native browser window.

// Report crashes to our server.
require('crash-reporter').start()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null

app.on('before-quit', function () {
  console.log('Will quit! (before-quit) // main') // XXX
  // TODO: send event to Renderer
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OSX it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // if (process.platform !== 'darwin') {
  app.quit()
})

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: (GAME_WIDTH + GAME_WIDTH_PADDING),
    height: (GAME_HEIGHT + GAME_HEIGHT_PADDING)
  })

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/game/index.html')

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
})

// use in browser - http://localhost:8315/
// for more see http://blog.chromium.org/2011/05/remote-debugging-with-chrome-developer.html
/*
app.commandLine.appendSwitch('remote-debugging-port', '8315')
app.commandLine.appendSwitch('host-rules', 'MAP * 127.0.0.1')
*/
