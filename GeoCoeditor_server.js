

const httpServer = require('http').createServer();


 const io = require('socket.io')(httpServer, {
//const io = require('/usr/local/lib/node_modules/socket.io')(httpServer, {
  maxHttpBufferSize: 1e8,
  pingTimeout: 100000,
  pingInterval: 300000,
  cors: {
origin: "http://192.168.1.116:8080",   
    methods: ["GET", "POST"]
  }
});



var algorithm="YJS";
var firstClient=false;
var klijenti = {};

io.on('connection', socket => {
  	console.log('---------------connect---------------');
  	socket.emit('connected', { algorithm: algorithm });

	if (!firstClient) {
			socket.emit('controller', { algorithm: algorithm });
			firstClient=socket.id;
			console.log('Controller connected');
	}


	var klijent = {};
  	klijent.clientId=socket.id;
	klijent.name="";
	klijent.status=1;
	klijenti[socket.id] = klijent;
	

	socket.on('send id', (data) => {
   	 klijenti[socket.id].clientId = data.clientId;
	 klijenti[socket.id].name = data.name;
	 io.emit('participant update', klijenti);
  	});

        socket.on('disconnect', (msg) => {
   	 klijenti[socket.id].status = 0;
	 io.emit('participant update', klijenti);
  	});

	socket.on('done editing', (msg) => {
   	 klijenti[socket.id].status = 2;
	 io.emit('participant update', klijenti);
  	});


  	socket.on('chat message', (msg) => {
   	 socket.broadcast.emit('chat message', msg);
  	});


	socket.on('Algorithm setup', (data) => {
		algorithm=data.algorithm;
		console.log('Algorithm='+algorithm);
  	});


	socket.on('CRDT change creation', (data) => {
		socket.broadcast.emit('CRDT change creation', data); 
		//console.log ("poruka=" + data.messageNumber + " klijent=" + data.id + " baza=" + data.basis + " delta=" + JSON.stringify (data.delta) );
  	});

	
	socket.on('CRDT object creation', (data) => {
		socket.broadcast.emit('CRDT object creation', data); 
  	});

	
	socket.on('Session status request', (data) => {
		io.emit('Session status request', data); 
  	});

	socket.on('Session status report', (data) => {
		io.emit('Session status report', data); 
  	});


	socket.on('Conversion data', function (data) {
		io.to(firstClient).emit('Conversion data', data);
	});

	socket.on('Error data', function (data) {
		io.to(firstClient).emit('Error data', data); 
	});



	socket.on('reset server', (data) => {
		io.emit('client reset', data); 
		io.disconnectSockets();
		console.log ("Server reset remotely initiated...");
		firstClient=false;
		algorithm="YJS"
		klijenti = {};
  	});
  
});



httpServer.listen(2500, () => {
  console.log('Listening...');
});
