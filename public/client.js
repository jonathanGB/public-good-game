// client-side js
// run by the browser each time your view template is loaded

console.log('hello world :');

const socket = io();
const bid = document.getElementById('bid');
const statusNode = document.getElementById('status');
const tbody = document.querySelector('#results tbody');
const numPlayersNode = document.getElementById('numPlayers');
let numPlayers = 0;
let yourUsername;

function insertPlayer([username, {init}]) {
  const tr = document.createElement('tr');
  tr.id = username;
  
  const tdUsername = document.createElement('td');
  tdUsername.innerText = username;
  if (username === yourUsername) {
    tdUsername.classList.add("your-username"); 
  }
  
  const tdInitial = document.createElement('td');
  tdInitial.innerText = `$${init}`;
  
  tr.appendChild(tdUsername);
  tr.appendChild(tdInitial);
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));

  tbody.appendChild(tr);
}

function updatePlayerEntry([username, {winner, isBidding, outcome}]) {
  let playerEntry = document.getElementById(username);
  playerEntry.classList.add(winner ? "winner" : "looser");
  
  let tds = playerEntry.querySelectorAll('td');
  let [biddingTd, outcomeTd] = [tds[2], tds[3]];
  biddingTd.innerText = isBidding ? "yes": "no";
  outcomeTd.innerText = `$${outcome}`;
}

function updateNumPlayers(delta) {
  numPlayers += delta;
  
  numPlayersNode.innerText = numPlayers;
}

function drawHistogram({bid, noBid}) {
  let bidTrace = {
    x: bid,
    type: 'histogram',
    opacity: 0.5,
    name: 'Bid timeline',
  };
  let noBidTrace = {
    x: noBid,
    type: 'histogram',
    opacity: 0.6,
    name: 'No-bid timeline',
  };
  const data = [bidTrace, noBidTrace];
  const layout = {barmode: "overlay"};
  Plotly.newPlot("histogram", data, layout);
}

if (document.querySelector('html').dataset.role === "ruler") {
  socket.emit('get status', status => {
    console.log(status);
    document.querySelectorAll('#status input')[status].checked = true;
  });

  document.querySelectorAll('#status input').forEach(input => {
    input.onchange = function() {
      if (this.checked) {
        socket.emit('new status', this.value); 
      }
    };
  });
  
  socket.on('now finished', ({players, biddingHistory}) => {
    bid.style.visibility = "hidden";

    players.forEach(updatePlayerEntry);
    
    drawHistogram(biddingHistory);
  });
} else {
  socket.emit('register', ({username, players}) => {
    console.log(username);
    document.getElementById('username').innerText = username;
    yourUsername = username;

    players.forEach(insertPlayer);
    updateNumPlayers(players.length);
  });
  
  socket.on('reload', () => {
    window.location.reload();
  });
  
  bid.onchange = ({target}) => {
    socket.emit('change bid', target.value === "bid");
  };
  
  socket.on('now finished', ({players}) => {
    bid.style.visibility = "hidden";

    players.forEach(updatePlayerEntry);
  });
}

socket.on('new player', player => {
  insertPlayer(player);
  updateNumPlayers(1);
});

socket.on('remove player', username => {
  tbody.removeChild(document.getElementById(username));
  updateNumPlayers(-1);
});

socket.on('now choosing', factor => {
  document.getElementById('factor').innerText = factor;
  bid.style.visibility = "visible";
  // UPDATE FACTOR
});