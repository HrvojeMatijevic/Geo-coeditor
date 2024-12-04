# Geo-coeditor

This is the implementation of CRDT based real-time GIS geometry co-editing system following the
paper [Matijević, Vranić, Kranjčić, Cetl (2024). Real-time co-editing of geographic features](#).

## Concept and architecture
It works using [Joseph Gentle’s Reference CRDTs](https://github.com/josephg/reference-crdts) and
[OpenLayers](https://openlayers.org/). The application uses [Socket.io](https://socket.io/) as a communication
platform. The original TS code was converted into pure Javascript using tsc.
The system is composed out of a web client and a server. All business logic, including the CRDT
algorithms is implemented in pure Javascript and runs exclusively on the client. The server only
distributes operations to all clients participating in a session. To deploy the system, a NodeJS running
the server and a simple http server to serve the application is needed. We ran the server on an old
core i5 4300U laptop with 8 GB of RAM during the tests described in the paper, so nothing special
needed there. Make sure to open the port that Socket.io uses on the server or simply disable firewall
fs windows is used and opening the needed port proves too hard to accomplish (this is not a
recommended option though).

## Working with the application

To start working, multiple clients need to be connected to the server. This is simply done by
accessing the app served by http server by each user. The first client to connect will be the session
controller. The first client can drag&amp;drop a single polygon (with no holes) encoded in geoJSON which
is then broadcasted to all other clients. Then, co-editing can start.
By clicking inside the polygon a client will initiate OL Modify interaction. By clicking outside of the
polygon the interaction is disabled. This can be done any number of times.
When in modify mode, users can do standard OL add point and move point along with delete point
(holding alt key on the keyboard).
Some statistic and similar data can be generated (request session status and generate report
buttons). Using the reset server button a new session can be started.
NOTE: When in editing mode, if a user clicks inside of the polygon then the client is in paused mode
(signalled by displaying the coordinates in red color). While in paused mode, the client still receives
remote updates but does not integrate nor redraw until the client exits the paused mode. Exiting of
the paused mode is don by completing a local edit or by exiting editing mode.

## LICENSE

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Copyright 2024 [Hrvoje Matijević](https://www.linkedin.com/in/hrvojematijevic/), [Saša Vranić](https://www.linkedin.com/in/svranic/), 
[Nikola Kranjčić](https://www.linkedin.com/in/nikolakranjcic/), [Vlado Cetl](https://www.linkedin.com/in/vlado-cetl-3ab37a7/)
