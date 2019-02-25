var express = require('express');
var app = express();

const axios = require('axios');
const geolib = require('geolib');

var mock = 
{"full_count":15134,"version":4,"1f9e0f95":["4BAA42",45.8425,5.0910,52,4050,216,"4065","F-LFLY1","A321","TC-JRB",1551115772,"LYS","IST","TK1810",0,896,"THY7JK",0,"THY"]
,"stats":{"total":{"ads-b":11771,"mlat":1342,"faa":1039,"flarm":10,"estimated":703},"visible":{"ads-b":1,"mlat":0,"faa":0,"flarm":0,"estimated":0}}}

var baseUrl = 'https://data-live.flightradar24.com';

var bigBounds = '46.04,45.53,4.43,5.76';
var dagneuxBounds = '45.90,45.80,4.88,5.20';
var dagneuxGPS_lt = '45.8551';
var dagneuxGPS_lg = '5.0747';

var bounds = bigBounds;
//var bounds = dagneuxBounds;

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function(req, res) {
	//var distance = geolib.getDistance({latitude: dagneuxGPS_lt, longitude: dagneuxGPS_lg}, {latitude: "45.7880", longitude: "5.1085"});

	//console.log(distance);
	
	axios.get(baseUrl+'/zones/fcgi/feed.js?bounds='+bounds+'&faa=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1&estimated=1&maxage=14400&gliders=1&stats=1').then(function(response) {
		var flightResponse = response.data;
		//var flightResponse = mock;
		var flights = [];
		var flightsDetail = {};
		
		for(let field in flightResponse){
			if(['full_count','version','stats','visible'].indexOf(field) == -1){
				flights.push(field);
			}
		}
		
		var flightsPromises = [];
		
		for(let flight of flights){
			flightsDetail[flight] = {};
			flightsPromises.push(axios.get(baseUrl+'/clickhandler/?version=1.5&flight='+flight));
				/*.then(function(response){
				var data = response.data;
				
				flightsDetail[flight]['flight'] = data['identification']['callsign'];
				flightsDetail[flight]['aircraft'] = data['aircraft']['model']['text'];
				flightsDetail[flight]['airline'] = data['airline']['short'];
				flightsDetail[flight]['origin'] = data['airport']['origin']['code']['iata'];
				flightsDetail[flight]['destination'] = data['airport']['destination']['code']['iata'];
				console.log('flightsDetail',flightsDetail);
				res.send(flightsDetail);
				console.log('res',flightsDetail);
				
			});*/
		}
		
		//console.log('flightsPromises',flightsPromises);
		Promise.all(flightsPromises).then(function(flightsResponse){
			flightsResponse.forEach(flightResponse => {
				var data = flightResponse.data;
				//console.log('data',data);
				var flight = data['identification']['id'];
				flightsDetail[flight] = {};
				flightsDetail[flight]['flight'] = data['identification']['callsign'];
				flightsDetail[flight]['aircraft'] = data['aircraft']['model']['text'];
				//flightsDetail[flight]['airline'] = data['airline']['short'];
				//flightsDetail[flight]['origin'] = data['airport']['origin']['code']['iata'];
				//flightsDetail[flight]['destination'] = data['airport']['destination']['code']['iata'];
				flightsDetail[flight]['latitude'] = data['trail'][data['trail'].length-1]['lat'];
				flightsDetail[flight]['longitude'] = data['trail'][data['trail'].length-1]['lng'];
				flightsDetail[flight]['distance'] = geolib.getDistance({latitude: dagneuxGPS_lt, longitude: dagneuxGPS_lg}, {latitude: flightsDetail[flight]['latitude'], longitude: flightsDetail[flight]['longitude']})/1000+'km';
			})
			
			res.send(flightsDetail);
		});
	
	});
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})