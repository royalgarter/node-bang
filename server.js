var port = process.env.PORT || 8080;

var express = require('express'),
    http = require('http'),
    socketIO = require('socket.io'),

    log = require('./server/log.js'),
    users = require('./server/users.js'),

    lobby = require('./server/lobby.js'),
    game = require('./server/game.js'),
    login = require('./server/login.js');

var app = express(),
    server = http.Server(app),
    io = socketIO(server);

app.use(express.static('public'));
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/pages/index.html');
});

login.setup(io, users);
game.setup(io, users, login);
lobby.setup(io, users, login);

server.listen(port, function() {
    log('Listening on port', port);
});
