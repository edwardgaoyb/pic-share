WebRTC Download Demo
======================

## Prerequisites

|Env|Version|
|---|---|
|OS|Ubuntu 20.04.1|
|NodeJS|v14.19.1|
|Docker|20.10.14|
|docker-compose|1.29.2|


## Architecture

The client program is a react app and the server program is a WebSocket server for signaling.

1. All the clients register the file partitions they have to the Signaling server.
1. Client #1 requests partitons from Client #2 and Client #3
1. When all the partitions are downloaded to Client #1, the file will be displayed in a preview window


## Development

Clone and install project dependecies using npm or yarn 

`` yarn install ``

Use the script to launch one server and three clients:

`` ./launch_server_and_3_clients.sh ``

Three Browser windows (or tabs) will be opened. A 'Download partitions' button will be shown in one of the windows (the window with url `localhost:3010`).

The other 2 clients do not have this button.

Click the download button, wait for all the partitions to be downloaded from the other 2 clients (browsers).

A preview window will show the following picture:
![](/public/sample_data/orig.jpg)

## Simulate the multipe-node environment with Docker

(Install docker engine and docker compose before start)

Build the docker images

`` ./build_client.sh ``
`` ./build_server.sh ``

Launch a signaling server and 3 clients

`` docker-compose up``

To access the clients, open a browser window and visit the following URLs:
1. localhost:3010
1. localhost:3020
1. localhost:3030