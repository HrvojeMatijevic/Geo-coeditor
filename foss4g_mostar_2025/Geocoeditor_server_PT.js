

const httpServer = require('http').createServer();


 const io = require('socket.io')(httpServer, {
  maxHttpBufferSize: 1e8,
  pingTimeout: 100000,
  pingInterval: 300000,
  cors: {
origin: "http://192.168.1.120:8080",    
    methods: ["GET", "POST"]
  }
});


var algorithm="YJS";

var room1 = { id:'1', roomKey:'aaa', roomSessionKey:false, controllerId:false, resourceHolderId:false};
var room2 = { id:'2', roomKey:'bbb', roomSessionKey:false, controllerId:false, resourceHolderId:false};


var rooms = {'1':room1, '2':room2}

/*
Satus codes:
1 Connected to server
2 Joined a room
3 Has resource
4 done editing
*/

// ***** The part that controls remote automatic clients ******

const clientGroups = {};         // { groupName: Set<socket.id> }
const clientOpTimers = {};       // { socketId: TimeoutID }
const socketGroupMap = {};       // { socketId: groupName }

const opGenerationTimers = new Map(); // Map<socketId, Timeout>
let sequentialStartTimeouts = [];
let activeGroups = new Set(); // tracks which group IDs have started op generation


function scheduleNextOp(socket, groupName, minDelay = 1500, maxDelay = 3500) {
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  clientOpTimers[socket.id] = setTimeout(() => {
    socket.emit('generate-op-now');
    scheduleNextOp(socket, groupName, minDelay, maxDelay);
  }, delay);
}

function startOpsForGroup(groupName, minDelay = 1500, maxDelay = 3500) {

  if (activeGroups.has (groupName)) { console.log (" Group " + groupName + " already running"); return } // already running 
  activeGroups.add(groupName); 

  const group = clientGroups[groupName];
  if (!group) { console.log ("No Group " + groupName); return };

  for (const socketId of group) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && !clientOpTimers[socketId]) {
      scheduleNextOp(socket, groupName, minDelay, maxDelay);
    }
  }
  console.log(`Started op timers for group "${groupName}"`);
}

function stopOpsForGroup(groupName) {
  const group = clientGroups[groupName];
  if (!group) return;

  for (const socketId of group) {
    if (clientOpTimers[socketId]) {
      clearTimeout(clientOpTimers[socketId]);
      delete clientOpTimers[socketId];
      activeGroups.delete(groupName); // NOVO
    }
  }
  console.log(`Stopped op timers for group "${groupName}"`);
}

function stopOpsForAllGroups() {
  const groupsToStop = new Set();

for (const [key, value] of Object.entries(clientGroups)) {

    groupsToStop.add(key);
  }

  // Stop generators for each group
  for (const group of groupsToStop) {
    stopOpsForGroup(group);
  }
}

function stopAllOpGeneration() {
  for (const groupId of activeGroups) {
    stopOpsForGroup(groupId);
  }
  activeGroups.clear(); // optional, but ensures cleanup
}



function startSequentialGroupOps(groupIds, intervalMs = 60000) {
  let index = 0;

  function startNextGroup() {
    if (index >= groupIds.length) return;
    
    const groupId = groupIds[index];

    // This if statement enables skipping to start another group but keep interval
    if (activeGroups.has(groupId)) {
      console.log(`Group ${groupId} already active, skipping start but waiting ${intervalMs}ms`);
    } else {
      console.log(`Starting op generation for group ${groupId}`);
      startOpsForGroup(groupId);
    }
    // Until here

    index++;
    if (index < groupIds.length) {
      const timeoutId = setTimeout(startNextGroup, intervalMs);
      sequentialStartTimeouts.push(timeoutId);
    }
  }

  // Clear any existing sequence first
  stopSequentialGroupOps();

  startNextGroup();
}

function stopSequentialGroupOps() {
  sequentialStartTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  sequentialStartTimeouts = [];
}

// ***** End of remote control of automatic clients ******


io.on('connection', socket => {
	socket.eStatus=1;
	var clientsRoom=false;

  	console.log('---------------connect---------------');
  	socket.emit('connected', { algorithm: algorithm });

	
	function generateKey() {
    	let key = '';
    	let str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
       		'23456789';
    	for (let i = 1; i <= 5; i++) {
        	let char = Math.floor(Math.random()
            	* str.length + 1);

        	key += str.charAt(char)
    	}
    	return key;
	}

	function notifyParticipantUpdate () {
	var socsInRoom = {};
	io.in(clientsRoom).fetchSockets()
			.then((socketsIn) => {
			socketsIn.forEach((socketIn) => {
					socsInRoom[socketIn.id]={name:socketIn.uName, status:socketIn.eStatus}
					 })
			return socsInRoom}).then((socsList) => {
				//console.log ("NOTIFYING")
				//console.log (socsList)
				if (clientsRoom) io.to(clientsRoom).emit('participant update', socsList); // Svima
			})
	}


	
// ***** Per socket remote automatic client control ******

socket.on('send id', (data) => {
    socket.uName = data.name;
    const groupName = data.name;
    socketGroupMap[socket.id] = groupName;
    if (!clientGroups[groupName]) clientGroups[groupName] = new Set();
    clientGroups[groupName].add(socket.id);
    notifyParticipantUpdate();
  });

  socket.on('start ops group', (data) => {
    startOpsForGroup(data.name, data.minDelay, data.maxDelay);
  });

  socket.on('stop all op generation', (data) => {
    console.log('Stopping all active op generators');
    stopAllOpGeneration();
  });

socket.on('start op generation sequence', (data) => {
  const groupSequence = data.groups || [];
  const interval = data.interval || 60000;

  console.log(`Received request to start sequential op gen for groups: ${groupSequence} every ${interval}ms`);
  startSequentialGroupOps(groupSequence, interval);
});

socket.on('stop op generation sequence', () => {
  console.log('Stopping all scheduled group starts');
  stopSequentialGroupOps();
});


// ****** End of per socket remote automatic clients control ******

socket.on('disconnect', () => {
    const groupName = socketGroupMap[socket.id];
    if (groupName && clientGroups[groupName]) {
      clientGroups[groupName].delete(socket.id);
    }
    if (clientOpTimers[socket.id]) {
      clearTimeout(clientOpTimers[socket.id]);
      delete clientOpTimers[socket.id];
    }
    delete socketGroupMap[socket.id];
  });


	socket.on('done editing', (msg) => {	
		socket.eStatus=4;
		notifyParticipantUpdate ();
  	});



	socket.on('join room', (msg) => {
		console.log (msg.roomNr + "  " + msg.roomKey)
		var roomKeyIs=false;
		var roomSessionKeyIs=false;
		var roomOpen=false;
		if (rooms[msg.roomNr] != undefined) {
			roomKeyIs=rooms[msg.roomNr].roomKey;
			roomSessionKeyIs=rooms[msg.roomNr].roomSessionKey;
			roomOpen=rooms[msg.roomNr].roomSessionKey;
			firstClient= rooms[msg.roomNr].controllerId;
			//console.log (roomKeyIs + " " + roomSessionKeyIs + " " + firstClient)
		}
		
		if (roomKeyIs && roomOpen && msg.roomKey==roomKeyIs){
   	 		socket.join(msg.roomNr);
			rooms[msg.roomNr].controllerId=socket.id;
			clientsRoom = [...socket.rooms].filter(item => item!=socket.id);
			socket.emit('controller', { algorithm: algorithm });
			var responseText='You are controller of room'+ clientsRoom
			socket.emit('room access response', { room: clientsRoom ,status: 2, message: responseText});
			notifyParticipantUpdate ();
		} else if (roomKeyIs && !roomOpen && msg.roomKey==roomKeyIs){
   	 		socket.join(msg.roomNr);
			clientsRoom = [...socket.rooms].filter(item => item!=socket.id);
			socket.emit('controller', { algorithm: algorithm });
			roomKey=generateKey();
			var responseText='You reconnected as controller of room'+ clientsRoom + 'room key=' + roomKey;
			rooms[clientsRoom].roomSessionKey=roomKey;
			socket.emit('room access response', { room: clientsRoom ,status: 2, message: responseText});
			notifyParticipantUpdate ();
		} else if (roomKeyIs && roomOpen && msg.roomKey==roomSessionKeyIs) {
			socket.join(msg.roomNr);
			clientsRoom = [...socket.rooms].filter(item => item!=socket.id);
			var responseText='You are in room'+ clientsRoom
			socket.emit('room access response', { room: clientsRoom ,status:2, message: responseText});
			notifyParticipantUpdate ();
		} else {
			socket.emit('room access response', { room: 'none' ,status:1, message: 'Access denied' });
		}
  	});


  	socket.on('chat message', (msg) => {
   	 if (clientsRoom) socket.broadcast.to(clientsRoom).emit('chat message', msg);// //svima osim pošiljaocu
  	});

	socket.on('Algorithm setup', (data) => {
		algorithm=data.algorithm;
		//console.log('Algorithm='+algorithm);
  	});

	socket.on('CRDT change creation', (data) => {
		if (clientsRoom) socket.broadcast.to(clientsRoom).emit('CRDT change creation', data); //svima osim pošiljaocu
  	});

	socket.on('CRDT object creation', (data) => {
		if (clientsRoom) 
			rooms[clientsRoom].resourceHolderId=socket.id;
			socket.eStatus=3;
			socket.broadcast.to(clientsRoom).emit('CRDT object creation', data); //svima osim pošiljaocu
  	});

	socket.on('resource acquired', (data) => {
		socket.eStatus=3;
  	});

	socket.on('request current', (data) => {
		if (clientsRoom){
			var targetClientId= rooms[clientsRoom].resourceHolderId;
			if (targetClientId) {
				//console.log ("Client " + data.clientid + " requested current")
		    		io.to(targetClientId).emit('request current', {clientid: data.clientid}); // Samo jednom klijentu
			}
		}
  	});


	socket.on('deliver current', (data) => {
		if (clientsRoom) {
			//console.log ("Got delivered ")
			io.to(data.clientid).emit('CRDT object creation', {crdtdoc: data.crdtdoc}); // To the requesting client only
		}
  	});


	socket.on('Session status request', (data) => {
		if (clientsRoom) io.to(clientsRoom).emit('Session status request', data); //svima i pošiljaocu
  	});

	socket.on('Session status report', (data) => {
		if (clientsRoom) io.to(clientsRoom).emit('Session status report', data); //svima i pošiljaocu
  	});


	socket.on('Conversion data', function (data) {
		if (clientsRoom){
			io.to(clientsRoom).emit('Conversion data', data);
		 }
	});

	socket.on('Error data', function (data) {
		if (clientsRoom){
			io.to(clientsRoom).emit('Error data', data);
		}
	});



	socket.on('reset session', (data) => {
		io.to(clientsRoom).emit('client reset', data); //svima pa i pošiljaocu
		console.log ("Session reset remotely initiated...");
		algorithm="YJS"
  	});

	socket.on('close room', (data) => {
		rooms[clientsRoom].resourceHolderId=false;
		rooms[clientsRoom].controllerId=false;
		rooms[clientsRoom].roomSessionKey=false;
		io.to(clientsRoom).disconnectSockets();
		console.log ("Room closing initiated...");
		//console.log (rooms)
		
  	});

  
});


// Entering a room. Set the target socket status and notify everyone.
io.of("/").adapter.on("join-room", (room, id) => {
		var socsInRoom = {};
		
		io.in(room).fetchSockets()
			.then((socketsIn) => {
			//socsInRoom[socketIn.id]={name:socketsIn.uName, status:socketsIn.eStatus}
			socketsIn.forEach((socketIn) => {
					if (socketIn.id==id) socketIn.eStatus=2;
					socsInRoom[socketIn.id]={name:socketIn.uName, status:socketIn.eStatus}
					 })
			return socsInRoom}).then((socsList) => {
				//console.log (socsInRoom)
				io.to(room).emit('participant update', socsList);
			})

});

// Leaving a room occurs when client disconnects. Set the target socket status and notify everyone.
io.of("/").adapter.on("leave-room", (room, id) => {
		
	if (rooms[room]!= undefined){
		var socsInRoom = {};
		var reassingResourceHolder=false;
		if (rooms[room].resourceHolderId==id) reassingResourceHolder=true;
		
		io.in(room).fetchSockets()
			.then((socketsIn) => {
			socketsIn.forEach((socketIn) => {
					if (socketIn.id==id) socketIn.eStatus=0;
					if (reassingResourceHolder && socketIn.eStatus>2) {rooms[room].resourceHolderId=socketIn.id; reassingResourceHolder=false}
					socsInRoom[socketIn.id]={name:socketIn.uName, status:socketIn.eStatus}
					 })
			return socsInRoom}).then((socsList) => {
				//console.log (socsInRoom)
				io.to(room).emit('participant update', socsList);
			})
	}
});






httpServer.listen(2500, () => {
  console.log('Listening...');
});
