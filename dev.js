#!/usr/bin/env node

/*
 * don't forget to run 'nvm use' first
 */

var electron = require('electron-prebuilt')
var proc = require('child_process')

console.log('# Executing binary from path:', electron)

proc.spawn(electron, [__dirname], {stdio: 'inherit'})
