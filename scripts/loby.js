const startButton = document.getElementById('start-button');
const backButton = document.getElementById('back-button');
const joinButton = document.getElementById('join-button');
const createButton = document.getElementById('create-button');
const mapSelect = document.getElementById('map-select');
const playerCountSelect = document.getElementById('player-count-select');
const optionScreen = document.querySelector('.option-screen');
const createScreen = document.querySelector('.create-screen');
import { io } from 'socket.io-client';

const socket = io(import.meta.env.PROD ? undefined : 'http://localhost:3000');
socket.emit('checkGameStatus');

socket.on('gameIsActive', () => {
  if (createButton) {
    createButton.style.display = 'none';
  }
});

joinButton.addEventListener('click', () => {
  optionScreen.style.display = 'none';
});

createButton.addEventListener('click', () => {
  optionScreen.style.display = 'none';
  createScreen.style.display = 'block';
  socket.emit('playerCreatingGame');
});

socket.on('someoneCreatingGame', () => {
  if (createButton) {
    createButton.style.display = 'none';
  }
});

// socket.on('cancel-create', () => {
//   if (createButton) {
//     createButton.style.display = 'none';
//   }
// });

socket.on('show-create-button', () => {
  if (createButton) {
    createButton.style.display = 'block';
  }
});

backButton.addEventListener('click', () => {
  createScreen.style.display = 'none';
  optionScreen.style.display = 'block';
});

startButton.addEventListener('click', () => {
  const selectedMap = mapSelect.value;
  const playerCount = playerCountSelect.value;
  window.location.href = `game.html?map=${selectedMap}&players=${playerCount}`;
});
