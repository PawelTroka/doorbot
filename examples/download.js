#!/usr/bin/env node

/*
 *
 * To use this: npm install async mkdirp request doorbot
 *
 */

const RingAPI = require('../doorbot');
const async = require('async');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const url = require('url');
const request = require('request');

const dateFormat = require('dateformat');

/*
 * Configure your settings here:
 * email, password, historyLimit
 */
const ring = RingAPI({
    email: 'pawel.troka@outlook.com',
    password: '0y9&%bol00$hwWi0mAS7gGi8!N7Vz%M8ea1%PD@Vr8Risxo0LW',
});
const historyLimit = -1000000;

var loopForOlder = true;
var skipExistingFiles = true;
// Parse 1st command line argument to take in the ID of what we want this to be older than, otherwise start with most recent
var olderthan = '0';

//Variables for tracking what the oldest file in a run is, as well as the previous oldest-file we started at, to determine when we are no longer receiving additional older files anymore
var oldestFile = parseInt('9999999999999999999');  // Expected max file ID, 19 digits
var lastOldest = olderthan;                        // null if not given as cmd line argument

const base = path.join(__dirname, 'downloads');

fs.mkdir(base, () => { //ignoring if it exists..
    const doAgain = (goBack) => {	
        // Implements the get-next-100-oldest feature
        console.log("DPO doAgain called with goBack = " + goBack);
        if (goBack !== null) {
            olderthan = goBack;
            console.log('DPO Getting more, olderthan: ' + olderthan);
        }
	
        // First argument is HistoryLimit, max return is 100 so I hardcoded 1000 to make sure this number is bigger than what the API returns
        ring.history(10000, olderthan, (e, history) => {
            const fetch = (info, callback) => {
                ring.recording(info.id, (e, recording) => {
                    // Calculate the filename we want this to be saved as
                    console.log("DPO Info ", info);
                    const dateCreated = info['created_at'];
                    if ((e == null) && (typeof recording != 'undefined')) {
			const datea = dateFormat(info['created_at'],"yyyy_mm_dd_HH.MM.ss_Z");  // i.e, 2019-09-07T23:14:28.000Z
		 // Constructed path ended in _stamp.mp4 which broke the file ID. Changed offset from -4 to -10 to remove string chars.
		 // const partFilePath = url.parse(recording).pathname.substring(0,url.parse(recording).pathname.length - 4);
         const partFilePath = url.parse(recording).pathname.substring(0,url.parse(recording).pathname.length - 10);
			const parts = partFilePath.split('/');
			const filePath = '/' + parts[1] + '/' + datea + '_' + parts[2] + '.mp4';
			const file = path.join(base, '.', filePath);
					
			// Track the smallest ID, which is the oldest ID in this batch
			if (info['id'] < oldestFile) {
                            oldestFile = info['id'];
			} 
	
			// Make sure the directory exists
			const dirname = path.dirname(file);
			mkdirp(dirname, () => {
                            // Tracking variable
                            var writeFile = true;
        
                            // Test if the file we are about to write already exists
                            try {
				fs.accessSync(file);
				console.log('File Exists, Skipping: ', file);
				writeFile = false;
                            } catch (err) {
				writeFile = true;
                            }
                        
                            // If we aren't skipping existing files, we write them regardless of the write-file value
                            if (skipExistingFiles && !writeFile) {
				return callback();
                            }
        
                            console.log('Fetching file', file);
                            const writer = fs.createWriteStream(file);
                            writer.on('close', () => {
				console.log('Done writing', file);
				callback();
                            });
                            request(recording).pipe(writer);
			});
                    } else {
                        console.log("DPO ERROR ", e);
                    }
                });
            };
	
            async.eachLimit(history, 10000, fetch, () => { // increased from 10 to 10000, fetch is a function 
                console.log('DPO Oldest File: ' + oldestFile);
				
                // If we started at the most recent video and don't have an existing oldest, 
                // or if we found a new, older Video ID, we start the look again from there - assuming loopForOlder is true
                if ((lastOldest === null || lastOldest !== oldestFile) && loopForOlder) {
                    console.log('DPO about to loop, setting lastOldest to ' + oldestFile);
                    lastOldest = oldestFile;
                    doAgain(lastOldest); //If we could a new oldest file, start again from there
                } else {
                    console.log('DPO NOT LOOPING, lastOldest is ' + lastOldest + " while oldestFile is " + oldestFile);
                }
            });
        });    
    };
    doAgain(null); // Initially start it
});
