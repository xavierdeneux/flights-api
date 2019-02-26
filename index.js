var express = require('express');
var app = express();

const axios = require('axios');
const geolib = require('geolib');
const airports = require('airport-codes');


// Api flightradar24
const baseUrl = 'https://data-live.flightradar24.com';

// Coordonnées GPS
const bigBounds = '46.04,45.53,4.43,5.76'; // zone très large, utilisée pour débugguer l'app quand il n'y a pas assez de vol dans le périmètre
const homeBounds = '46e.90,45.80,4.88,5.20';
const homeLatitude = '45.8551';
const homeLongitude = '5.0747';

// On choisi le bounds qu'on va utiliser
let bounds;
bounds = bigBounds;
//bounds = homeBounds;

app.get('/', function(req, res) {
	const url = baseUrl+'/zones/fcgi/feed.js?bounds='+bounds+'&faa=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1&estimated=1&maxage=14400&gliders=1&stats=1';

	axios.get(url).then(flightsInBoundsResponse => {
		let flightsInBounds = flightsInBoundsResponse.data;
		let flightsDetail = {};
		let flightsPromises = [];

		const excludedFields = ['full_count','version','stats','visible'];

		for(let flight in flightsInBounds){
			console.log('x', flightsInBounds)
			// Si la propriété ne fait pas partie des champs exclus, c'est que c'est un avion.
			if(excludedFields.indexOf(flight) == -1){
				flightsDetail[flight] = {
					latitude : flightsInBounds[flight][1],
					longitude : flightsInBounds[flight][2],
					altitude : flightsInBounds[flight][4] / 3.281, // On convertit à la volée pieds en mètres
					speed : flightsInBounds[flight][5] * 1.60934, // On convertit à la volée miles/h en km/h
				};

				// Pour chaque vol dans la zone, on va devoir aller chercher le détail des ses infos.
				flightsPromises.push(axios.get(baseUrl+'/clickhandler/?version=1.5&flight='+flight));
			}
		}

		// Dès que toutes les infos de tous les avions sont récupérées, on passe à la suite
		Promise.all(flightsPromises).then(function(flightsDetailResponse){
			// On parcours chaque vol pour l'alimenter avec les nouvelles données reçues.
			flightsDetailResponse.forEach(flightDetailResponse => {
				let data = flightDetailResponse.data;
				let flightId = data['identification']['id'];
				flightsDetail[flightId] = flightsDetail[flightId] || {};
				flightsDetail[flightId]['flight'] = data['identification']['callsign'] ? data['identification']['callsign'] : 'No callsign';
				flightsDetail[flightId]['aircraft'] = data['aircraft'] && data['aircraft']['model'] && data['aircraft']['model']['text'] ? data['aircraft']['model']['text'] : '';
				flightsDetail[flightId]['airline'] = data['airline'] && data['airline']['name'] ? data['airline']['name'] : '';
				flightsDetail[flightId]['origin'] = data['airport'] && data['airport']['origin'] && data['airport']['origin'] && data['airport']['origin']['code'] && data['airport']['origin']['code']['iata'] ? data['airport']['origin']['code']['iata'] : '';
				flightsDetail[flightId]['destination'] = data['airport'] && data['airport']['destination'] && data['airport']['destination'] && data['airport']['destination']['code'] && data['airport']['destination']['code']['iata'] ? data['airport']['destination']['code']['iata'] : '';

				// On calcule avec geolib la distance qui sépare notre point gps (homeLatitude,homeLongitude) de notre avion. Pratique pour trouver l'avion au dessus de notre tête (= le plus près)
				flightsDetail[flightId]['distance'] = geolib.getDistance({latitude: homeLatitude, longitude: homeLongitude}, {latitude: flightsDetail[flightId]['latitude'], longitude: flightsDetail[flightId]['longitude']});

				// On ne connait pas toujours l'origine et/ou la destination des vols (pour quelques vols privés uniquement)
				// On en profite pour récupérer avec "airports" le nom de la ville correspondant au code aéroport. Ex: "CDG" = "Paris", "LYS" = "Lyon"
				if(flightsDetail[flightId]['origin']){
					flightsDetail[flightId]['origin'] = airports.findWhere({ iata: flightsDetail[flightId]['origin'] }).get('city');
				}

				if(flightsDetail[flightId]['destination']){
					flightsDetail[flightId]['destination'] = airports.findWhere({ iata: flightsDetail[flightId]['destination'] }).get('city');
				}
			})

			// Dernier traitement avant de renvoyer tout ça, on trie les vols par distance croissante, afin de récupérer en premier le vol au dessus de notre tête
			let response = [];
			for(let flight in flightsDetail){
				response.push(flightsDetail[flight]);
			}
			response = response.sort((a,b) => (a.distance > b.distance) ? 1 : ((b.distance > a.distance) ? -1 : 0));

			// That's all, on renvoie tout ça!
			res.send(response);
		});

	}).catch(error => {
		console.log('err', error),
		res.send({'error': error});
 	});
});


app.listen(3000, function () {
  console.log('Listen port 3000');
})