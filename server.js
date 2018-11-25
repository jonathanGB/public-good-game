// server.js
// where your node app starts

// init project
const express = require('express');
const randomWord = require('random-words');
const app = express();

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/ruler', (req, res) => {
  res.sendFile(`${__dirname}/views/ruler.html`);
});

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});

const io = require('socket.io')(listener);

const POSSIBLE_GAME_STATUS = {
  WAITING: 0,
  CHOOSING: 1,
  FINISHED: 2
};
let gameStatus = POSSIBLE_GAME_STATUS.WAITING
let players = new Map();
let biddingHistory = {
  bid: [],
  noBid: [],
};
let factor;
let timeGameStart;

io.on('connection', socket => {
  let username;
  console.log('a user connected');
  
  socket.on('get status', cb => cb(gameStatus));
  
  socket.on('disconnect', () => {
    if (!username || gameStatus !== POSSIBLE_GAME_STATUS.WAITING) {
      return;
    }
    
    players.delete(username);
    io.emit('remove player', username);
  });
  
  socket.on('new status', newStatus => {
    console.log(`new status: ${newStatus}`);
    gameStatus = POSSIBLE_GAME_STATUS[newStatus];
    
    if (gameStatus === POSSIBLE_GAME_STATUS.WAITING) {
      factor = undefined;
      players.clear();
      biddingHistory.bid = [];
      biddingHistory.noBid = [];
      timeGameStart = undefined;
      
      socket.broadcast.emit('reload');
    } else if (gameStatus === POSSIBLE_GAME_STATUS.CHOOSING) {
      factor = chooseFactor(players.size);
      timeGameStart = new Date();
      socket.broadcast.emit('now choosing', factor);
    } else {
      const payoff = computeRedistribution(players, factor);
      
      for (let [_, player] of players) {
        if (player.isBidding) {
          player.outcome = payoff;
        } else {
          player.outcome = player.init + payoff; 
        }
        
        player.winner = player.outcome >= player.init;
      }
      
      io.emit('now finished', {
        players: [...players],
        biddingHistory,
      });
      console.log(players);
    }
  });
  
  socket.on('register', cb => {
    if (gameStatus === POSSIBLE_GAME_STATUS.WAITING) {
      username = randomWord(2).join(' ');
      const init = 50;
      players.set(username, {
        init,
        isBidding: false,
      });
      cb({
        username,
        players: [...players],
      });
      socket.broadcast.emit('new player', [username, {init}]);
      console.log(players)
    }
  });
  
  socket.on('change bid', isBidding => {
    const timeBid = new Date() - timeGameStart;
    let player = players.get(username);
    player.isBidding = isBidding;
    
    if (isBidding) {
      biddingHistory.bid.push(timeBid);
    } else {
      biddingHistory.noBid.push(timeBid);
    }

    console.log(players);
    console.log(biddingHistory);
  });
});

function chooseFactor(n) {
  if (n > 5) {
    return Math.ceil(n/2);
  }
  
  return Math.floor(Math.random() * (n-2)) + 2  
}

function computeRedistribution(players, factor) {
  let payoff = 0;
  
  for (let [_, player] of players) {
    if (player.isBidding) {
      payoff += factor * player.init;
    }
  }
  
  return Math.round(payoff / players.size * 100) / 100;
}