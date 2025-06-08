import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname fix voor ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let playerCounter = 0;
let gameIsActive = false;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Pas aan als nodig, of specificeer je frontend URL
  },
});

// Serveer statische bestanden uit 'dist'
app.use(express.static(path.join(__dirname, 'dist')));

// Voor SPA: stuur bij elk ander pad index.html terug
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const players = {};

io.on('connection', socket => {
  console.log(`✅ Nieuwe speler verbonden: ${socket.id}`);
  if (gameIsActive) {
    socket.emit('cancel-create');
  }
  socket.on('game-bezig', () => {
    console.log(`🕹️ Speler ${socket.id} meldt dat de game bezig is`);
    socket.emit('cancel-create');
  });
  socket.on('playerCreatingGame', () => {
    console.log(`Speler ${socket.id} is bezig met een game te creëren`);
    gameIsActive = true;
    socket.broadcast.emit('someoneCreatingGame');
  });

  // Voeg nieuwe speler toe
  players[socket.id] = {
    id: socket.id,
    position: { x: 0, y: 1.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  };

  socket.on('startRequest', () => {
    playerCounter++;
    console.log(`📈 StartRequest ontvangen. Spelers verbonden: ${playerCounter}`);

    io.emit('updatePlayerCounter', playerCounter);
  });

  socket.emit('currentPlayers', players);

  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Beweeg speler
  socket.on('playerMovement', data => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;

      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position: data.position,
        rotation: data.rotation,
      });
    }
  });

  socket.on('shootBullet', data => {
    socket.broadcast.emit('bulletFired', data);
  });

  // socket.on('setBlock', ({ x, y, z, id }) => {
  //   socket.broadcast.emit('setBlock', { x, y, z, id });
  // });

  socket.on('playerHit', ({ hitPlayerId, shooterId }) => {
    console.log(`Player ${hitPlayerId} werd geraakt door ${shooterId}`);
    io.to(hitPlayerId).emit('playerHit', { hitPlayerId, shooterId });
  });

  socket.on('blockRemoved', ({ x, y, z }) => {
    socket.broadcast.emit('removeBlock', { x, y, z });
  });

  socket.on('mapChanged', ({ map }) => {
    console.log(`🗺️ Speler ${socket.id} veranderde map naar ${map}`);
    socket.broadcast.emit('mapChanged', { map });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Speler weg: ${socket.id}`);
    delete players[socket.id];

    if (playerCounter > 0) {
      playerCounter--;
      io.emit('updatePlayerCounter', playerCounter);
    }

    socket.broadcast.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server draait op http://localhost:${PORT}`);
});
