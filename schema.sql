drop table if exists weathers;
drop table if exists restaurants;
drop table if exists movies;
drop table if exists meetups;
drop table if exists trails;
drop table if exists locations;

create table locations (
  id serial primary key,
  search_query varchar(255),
  formatted_query varchar(255),
  latitude numeric(9,6),
  longitude numeric(9,6)
);

create table weathers (
  id serial primary key,
  forecast varchar(255),
  time varchar(255),
  created_at bigint,
  location_id integer not null,
  foreign key (location_id) references locations (id)
);

create table restaurants (
  id serial primary key,
  name varchar(255),
  url varchar(255),
  rating numeric(2,1),
  price varchar(5),
  image_url varchar(255),
  location_id integer not null,
  foreign key (location_id) references locations (id)
);

create table movies (
  id serial primary key,
  title varchar(255),
  released_on varchar(255),
  total_votes integer,
  average_votes numeric(3,1),
  popularity numeric(5,3),
  image_url varchar(255),
  overview varchar(255),
  location_id integer not null,
  foreign key (location_id) references locations (id)
);

create table meetups (
  id serial primary key,
  link varchar(255),
  name varchar(255),
  host varchar(255),
  creation_date varchar(25),
  location_id integer not null,
  foreign key (location_id) references locations (id)
  );

create table trails (
  id serial primary key,
  name varchar(255), 
  trail_url varchar(255),
  location varchar(255),
  length numeric(4,1),
  condition_date varchar(25), 
  condition_time varchar(25), 
  conditions varchar(255),
  stars numeric(3,1), 
  star_votes numeric(5,0), 
  summary varchar(255),
  location_id integer not null,
  foreign key (location_id) references locations (id)
);