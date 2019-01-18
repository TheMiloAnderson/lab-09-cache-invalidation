# City Explorer

**Author**: Milo & Tim
**Version**: 1.1.1 (increment the patch/fix version number if you make more commits past your first submission)

## Overview
This is a backend server app that retreives information about a city. It returns map data, weather forecasts, nearby restaurants, meetups, trails, and movies set in the given city.

## Getting Started
After you clone the repo, you will need to run 'npm i' in your console to install the dependencies. You will also need to create an .env file and add a PORT number and your own API keys, e.g.:

PORT=3000
DATABASE_URL=[db_url]
GEOCODE_API_KEY=[api_key]
WEATHER_API_KEY=[api_key]
YELP_API_KEY=[api_key]
MOVIE_API_KEY=[api_key]

You will also need to create a postgresql database named "city_explorer". Having done this, run "psql -d city_explorer -f schema.sql" to create the table schemas. Don't forget to add your DATABASE_URL to your .env file.

## Architecture
This app depends on express, cors, superagent, and dotenv. It reads incoming query parameters and uses a superagent 'get()' call to return data from various APIs, which is then parsed into an object and returned to the client. 

## Change Log
01-16-2019 10:00am - Refactored, application now has functioning routes for /location, /weather
01-16-2019 11:00am - Added route and API functionality for /yelp restaurants
01-16-2019 11:45am - Added route and API functionality for /movies
01-17-2019 130pm - Added DB caching functionality, refactored for generic dataLookup function
01-18-2019 200pm - Added cache invalidation, created routes/handlers for Meetups and Trails
<!-- Use this area to document the iterative changes made to your application as each feature is successfully implemented. Use time stamps. Here's an examples:

01-01-2001 4:59pm - Application now has a fully-functional express server, with a GET route for the location resource.
-->
## Credits and Collaborations
Jessica and Chris B. made invaluable contributions to earlier versions of this app.
<!-- Give credit (and a link) to other people or resources that helped you build this application. -->


> Number and name of feature: feature 1 -- adding meetup 
> Estimate of time needed to complete: 30 -45 min
> Start time: 9:15
> Finish time: 10:19
> Actual time needed to complete: 1hr

> Number and name of feature: feature 2 --adding trail info
> Estimate of time needed to complete: 1:00
> Start time: 10:30
> Finish time: 12:30
> Actual time needed to complete: 2:00

> Number and name of feature: cache invalidation
> Estimate of time needed to complete: 1:00
> Start time: 1:00
> Finish time: 1:40
> Actual time needed to complete: 0:40