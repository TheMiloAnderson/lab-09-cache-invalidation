'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

require('dotenv').config();
const PORT = process.env.PORT;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));

const app = express();

app.use(cors());

app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getRestaurants);
app.get('/movies', getMovies);
app.get('/meetups', getMeetups);
app.get('/trails', getTrails);

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

const timeouts = {
  weather: 1000 * 60,
  restaurant: 1000 * 60 * 60 * 24,
  movie: 1000 * 60 * 60 * 60 * 24 * 7,
  meetup: 1000 * 60 * 60 * 12,
  trail: 1000 * 60 * 60 * 24
}

// --- LOCATION --- //

function getLocation(req, res) {
  const locationHandler = {
    query: req.query.data,
    cacheHit: (results) => {
      console.log('Got Location SQL');
      res.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetchLocation(req.query.data)
        .then(data => res.send(data));
    }
  }
  Location.lookupLocation(locationHandler);
}

Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM  locations WHERE search_query=$1`;
  const values = [handler.query];
  return client.query(SQL, values)
    .then((results) => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      } else {
        handler.cacheMiss();
      }
    })
    .catch(console.error);
}

Location.fetchLocation = (query) => {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

  return superagent.get(url)
    .then((apiResponse) => {
      if (!apiResponse.body.results.length) {
        throw 'No Data';
      } else {
        let location = new Location(query, apiResponse.body.results[0]);
        return location.save()
          .then((result) => {
            location.id = result.rows[0].id;
            return location;
          });
      }
    })
    .catch((err) => handleError(err));
};

function Location(query, data) {
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

Location.prototype.save = function() {
  let SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude)
    VALUES ($1, $2, $3, $4) RETURNING id;`;
  let values = [this.search_query, this.formatted_query, this.latitude, this.longitude];
  return client.query(SQL, values);
};

// --- GENERIC DATA LOOKUP & HELPER FUNCTIONS --- //

function dataLookup(handler, table) {
  const SQL = `SELECT * FROM ${table} WHERE location_id=$1`;
  const values = [handler.location.id];
  client.query(SQL, values)
    .then((result) => {
      if (result.rowCount > 0) {
        console.log(`Got ${table} data from SQL`);
        handler.cacheHit(result);
      } else {
        console.log(`Got ${table} data from API`);
        handler.cacheMiss();
      }
    })
    .catch(err => handleError(err));
}

function deleteByLocationId(table, cityId) {
  const SQL = `DELETE FROM ${table} WHERE location_id=${cityId};`;
  client.query(SQL);
}

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Looks like today\'s not your day');
}

// --- WEATHER --- //

function getWeather(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      const ageOfResults = (Date.now() - result.rows[0].created_at);
      if (ageOfResults > timeouts.weather) {
        deleteByLocationId('weathers', this.location.id);
        console.log('Getting new weather data...');
        this.cacheMiss();
      }
    },
    cacheMiss: function() {
      Weather.fetch(req.query.data)
        .then((results) => res.send(results))
        .catch(console.error);
    }
  }
  dataLookup(handler, 'weathers');
}

Weather.fetch = function(location) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${location.latitude},${location.longitude}`;
  return superagent.get(url)
    .then((result) => {
      const weatherSummaries = result.body.daily.data.map((day) => {
        const summary = new Weather(day);
        summary.save(location.id);
        return summary;
      });
      return weatherSummaries;
    });
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000)
    .toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'});
  this.created_at = Date.now();
}

Weather.prototype.save = function(id) {
  const SQL = `INSERT INTO weathers (forecast, time, created_at, location_id) VALUES ($1, $2, $3, $4);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

// --- RESTAURANTS --- //

function getRestaurants(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      const ageOfResults = (Date.now() - result.rows[0].created_at);
      if (ageOfResults > timeouts.restaurant) {
        deleteByLocationId('restaurants', this.location.id);
        console.log('Getting new restaurant data...');
        this.cacheMiss();
      }
    },
    cacheMiss: function() {
      Restaurants.fetch(req.query.data)
        .then((results) => res.send(results))
        .catch(console.error);
    }
  }
  dataLookup(handler, 'restaurants');
}

Restaurants.fetch = function(location) {
  const url = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${location.latitude}&longitude=${location.longitude}`;
  return superagent.get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then((result) => {
      const foodReviews = result.body.businesses.map((restaurant) => {
        const listing = new Restaurants(restaurant);
        listing.save(location.id);
        return listing;
      });
      return foodReviews;
    });
}

function Restaurants(restaurant) {
  this.name = restaurant.name;
  this.url = restaurant.url;
  this.rating = restaurant.rating;
  this.price = restaurant.price;
  this.image_url = restaurant.image_url;
  this.created_at = Date.now();
}

Restaurants.prototype.save = function(id) {
  const SQL = `INSERT INTO restaurants (name, url, rating, price, image_url, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

// --- MOVIES --- //

function getMovies(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      const ageOfResults = (Date.now() - result.rows[0].created_at);
      if (ageOfResults > timeouts.movie) {
        deleteByLocationId('movies', this.location.id);
        console.log('Getting new movie data...');
        this.cacheMiss();
      }
    },
    cacheMiss: function() {
      Movies.fetch(req.query.data)
        .then((results) => res.send(results))
        .catch(console.error);
    }
  }
  dataLookup(handler, 'movies');
}

Movies.fetch = function(location) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${location.search_query}`;
  return superagent.get(url)
    .then((result) => {
      const movies = result.body.results.map((movie) => {
        const movieObj = new Movies(movie);
        movieObj.save(location.id);
        return movieObj;
      });
      return movies;
    });
}

function Movies(movie) {
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : 'http://media.graytvinc.com/images/810*607/Movie32.jpg';
  if (movie.overview.length > 254) {
    movie.overview = movie.overview.slice(0, 251) + '...';
  }
  this.overview = movie.overview;
  this.created_at = Date.now();
}

Movies.prototype.save = function(id) {
  const SQL = `INSERT INTO movies (title, released_on, total_votes, average_votes, popularity, image_url, overview, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

// --- MEETUPS --- //

function getMeetups(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      const ageOfResults = (Date.now() - result.rows[0].created_at);
      if (ageOfResults > timeouts.meetup) {
        deleteByLocationId('meetups', this.location.id);
        console.log('Getting new meetup data...');
        this.cacheMiss();
      }
    },
    cacheMiss: function() {
      Meetup.fetch(req.query.data)
        .then((results) => res.send(results))
        .catch(console.error);
    }
  }
  dataLookup(handler, 'meetups');
}

Meetup.fetch = function(location) {
  const url = `https://api.meetup.com/2/open_events?lat=${location.latitude}&lon=${location.longitude}&key=${process.env.MEETUP_API_KEY}&sign=true&only=group,event_url,name,created&page=20`;
  return superagent.get(url)
    .then((result) => {
      const meetups = result.body.results.map((meetup) => {
        const meetObj = new Meetup(meetup);
        meetObj.save(location.id);
        return meetObj;
      });
      return meetups;
    });
}

function Meetup(meetup) {
  this.link = meetup.event_url;
  this.name = meetup.name;
  this.host = meetup.group.name;
  this.creation_date = new Date(meetup.created)
    .toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'});
  this.created_at = Date.now();
}

Meetup.prototype.save = function(id) {
  const SQL = `INSERT INTO meetups (link, name, host, creation_date, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

// --- TRAILS --- //

function getTrails(req, res) {
  const handler = {
    location: req.query.data,
    cacheHit: function(result) {
      const ageOfResults = (Date.now() - result.rows[0].created_at);
      if (ageOfResults > timeouts.trail) {
        deleteByLocationId('trails', this.location.id);
        console.log('Getting new trail data...');
        this.cacheMiss();
      }
    },
    cacheMiss: function() {
      Trail.fetch(req.query.data)
        .then((results) => {
          res.send(results);
        })
        .catch(console.error);
    }
  }
  dataLookup(handler, 'trails');
}

Trail.fetch = function(location) {
  const url = `https://www.hikingproject.com/data/get-trails?lat=${location.latitude}&lon=${location.longitude}&key=${process.env.TRAILS_API_KEY}&maxResults=10`;
  return superagent.get(url)
    .then((result) => {
      const trails = result.body.trails.map((trail) => {
        const trailObj = new Trail(trail);
        trailObj.save(location.id);
        return trailObj;
      });
      return trails;
    });
}

function Trail(trail) {
  this.name = trail.name;
  this.trail_url = trail.url;
  this.location = trail.location;
  this.length = trail.length;
  const dateTime = new Date(trail.conditionDate);
  this.condition_date = dateTime.toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'});
  this.condition_time = dateTime.toLocaleTimeString('en-US');
  this.conditions = trail.conditionStatus;
  this.stars = trail.stars;
  this.star_votes = trail.starVotes;
  this.summary = trail.summary;
  this.created_at = Date.now();
}

Trail.prototype.save = function(id) {
  const SQL = `INSERT INTO trails (name, trail_url, location, length, condition_date, condition_time, conditions, stars, star_votes, summary, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

