// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBaSBOcnelUI93QefmW51sud19hN4lkJSQ",
    authDomain: "ttt-multiplayer-6de63.firebaseapp.com",
    databaseURL: "https://ttt-multiplayer-6de63-default-rtdb.firebaseio.com",
    projectId: "ttt-multiplayer-6de63",
    storageBucket: "ttt-multiplayer-6de63.firebasestorage.app",
    messagingSenderId: "51371239812",
    appId: "1:51371239812:web:7225224f30de35baf315d1"
};

// Initialize Firebase
let database;
try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
    // Show error message to user
    document.getElementById('createTab').innerHTML += `
        <div class="firebase-error">
            Firebase initialization failed. Please check your configuration.
        </div>
    `;
}

// DOM Elements
const boardEl = document.getElementById("board");
const modeEl = document.getElementById("mode");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomInput");
const resetBtn = document.getElementById("resetBtn");
const logEl = document.getElementById("log");
const linkBox = document.getElementById("linkBox");
const copyLink = document.getElementById("copyLink");
const modeLabel = document.getElementById("modeLabel");
const turnLabel = document.getElementById("turnLabel");
const playerLabel = document.getElementById("playerLabel");
const scoreX = document.getElementById("scoreX");
const scoreO = document.getElementById("scoreO");
const roundsEl = document.getElementById("rounds");
const bestOfEl = document.getElementById("bestOf");
const themeBtn = document.getElementById("themeBtn");
const statusMessage = document.getElementById("statusMessage");
const autoResetToggle = document.getElementById("autoReset");
const customAlert = document.getElementById("customAlert");
const joinRequestAlert = document.getElementById("joinRequestAlert");
const overlay = document.getElementById("overlay");
const alertMessage = document.getElementById("alertMessage");
const alertButtonOk = document.getElementById("alertButtonOk");
const alertButtonCancel = document.getElementById("alertButtonCancel");
const connectionDot = document.getElementById("connectionDot");
const connectionStatus = document.getElementById("connectionStatus");
const playerList = document.getElementById("playerList");
const roomFullMessage = document.getElementById("roomFullMessage");
const deleteRoomBtn = document.getElementById("deleteRoomBtn");
const roomList = document.getElementById("roomList");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const joinRequestMessage = document.getElementById("joinRequestMessage");
const acceptRequestBtn = document.getElementById("acceptRequestBtn");
const rejectRequestBtn = document.getElementById("rejectRequestBtn");
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const notificationBadge = document.getElementById("notificationBadge");
const browseTabButton = document.getElementById("browseTabButton");
const matchWinner = document.getElementById("matchWinner");

// Game state
let board = Array(9).fill(null);
let currentPlayer = "X";
let gameOver = false;
let scores = { X: 0, O: 0 };
let rounds = 0;
let maxRounds = parseInt(bestOfEl.value);
let mySymbol = null;
let roomId = null;
let isMultiplayer = false;
let autoResetEnabled = false;
let isConnected = false;
let players = {};
let isRoomFull = false;
let playerId = null;
let isRoomCreator = false;
let currentPage = 1;
let roomsPerPage = 20;
let joinRequestPlayerId = null;
let onlineStatus = navigator.onLine;
let pendingRequests = 0;
let matchCompleted = false;
let lastBoardState = JSON.stringify(board);

// Firebase references
let roomRef = null;
let roomsRef = null;
let playerRef = null;
let joinRequestsRef = null;

// Initialize the game
function init() {
    renderBoard();
    updateScoreUI();
    updateStatusMessage();

    // Event listeners
    modeEl.addEventListener("change", handleModeChange);
    createBtn.addEventListener("click", createRoom);
    joinBtn.addEventListener("click", joinRoom);
    resetBtn.addEventListener("click", resetGame);
    bestOfEl.addEventListener("change", updateMaxRounds);
    themeBtn.addEventListener("click", toggleTheme);
    copyLink.addEventListener("click", copyRoomLink);
    autoResetToggle.addEventListener("change", toggleAutoReset);
    alertButtonOk.addEventListener("click", hideAlert);
    alertButtonCancel.addEventListener("click", hideAlert);
    deleteRoomBtn.addEventListener("click", deleteRoom);
    prevPageBtn.addEventListener("click", () => changePage(-1));
    nextPageBtn.addEventListener("click", () => changePage(1));
    acceptRequestBtn.addEventListener("click", acceptJoinRequest);
    rejectRequestBtn.addEventListener("click", rejectJoinRequest);

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Check for room ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomInput.value = roomParam;
        modeEl.value = "multi";
        handleModeChange();
    }

    // Online/offline detection
    window.addEventListener('online', () => {
        onlineStatus = true;
        log("Connection restored");
        updateConnectionStatus(isConnected, connectionStatus.textContent);
    });

    window.addEventListener('offline', () => {
        onlineStatus = false;
        log("You are offline - some features may not work");
        updateConnectionStatus(false, "Offline - cannot connect to rooms");
    });

    // Load rooms list
    loadRoomsList();
}

// Switch between tabs
function switchTab(tabId) {
    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === tabId + 'Tab') {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    if (tabId === 'browse') {
        loadRoomsList();
        // Reset notification badge when viewing requests
        pendingRequests = 0;
        updateNotificationBadge();
    }
}

// Update notification badge
function updateNotificationBadge() {
    if (pendingRequests > 0) {
        notificationBadge.style.display = "flex";
        notificationBadge.textContent = pendingRequests;
    } else {
        notificationBadge.style.display = "none";
    }
}

// Load rooms list from Firebase
function loadRoomsList() {
    if (!onlineStatus) {
        roomList.innerHTML = "<div class='status-message status-error'>You are offline - cannot load rooms</div>";
        return;
    }

    if (!database) {
        roomList.innerHTML = "<div class='status-message status-error'>Firebase not configured</div>";
        return;
    }

    roomList.innerHTML = "<div class='loader'></div>";

    // Clear previous listeners
    if (roomsRef) {
        roomsRef.off();
    }

    roomsRef = database.ref('rooms');
    roomsRef.orderByChild('createdAt').limitToLast(roomsPerPage * currentPage).on('value', (snapshot) => {
        const rooms = snapshot.val();
        const roomsArray = [];

        if (rooms) {
            Object.keys(rooms).forEach(roomId => {
                if (rooms[roomId].players && Object.keys(rooms[roomId].players).length < 2) {
                    roomsArray.push({
                        id: roomId,
                        ...rooms[roomId]
                    });
                }
            });

            // Reverse to show newest first
            roomsArray.reverse();

            // Apply pagination
            const startIndex = (currentPage - 1) * roomsPerPage;
            const paginatedRooms = roomsArray.slice(startIndex, startIndex + roomsPerPage);

            // Update pagination buttons
            prevPageBtn.disabled = currentPage === 1;
            nextPageBtn.disabled = roomsArray.length <= currentPage * roomsPerPage;
            pageInfo.textContent = `Page ${currentPage}`;

            if (paginatedRooms.length === 0) {
                roomList.innerHTML = "<div class='status-message'>No rooms available. Create one!</div>";
                return;
            }

            roomList.innerHTML = '';
            paginatedRooms.forEach(room => {
                const playerCount = room.players ? Object.keys(room.players).length : 0;
                const roomItem = document.createElement('div');
                roomItem.className = 'room-item';
                roomItem.innerHTML = `
                    <div class="room-info">
                        <div>${room.roomName || 'Unnamed Room'}</div>
                        <div class="muted">Players: ${playerCount}/2 • Code: ${room.id}</div>
                    </div>
                    <div class="room-actions">
                        <button class="primary join-room-btn" data-room="${room.id}">Join</button>
                    </div>
                `;
                roomList.appendChild(roomItem);
            });

            // Add event listeners to join buttons
            document.querySelectorAll('.join-room-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const roomId = e.target.getAttribute('data-room');
                    roomInput.value = roomId;
                    switchTab('create');
                });
            });
        } else {
            roomList.innerHTML = "<div class='status-message'>No rooms available. Create one!</div>";
        }
    }, (error) => {
        roomList.innerHTML = "<div class='status-message status-error'>Error loading rooms</div>";
        log("Error loading rooms: " + error.message);
    });
}

// Change page in rooms list
function changePage(direction) {
    currentPage += direction;
    loadRoomsList();
}

// Update player list UI
function updatePlayerList() {
    playerList.innerHTML = "<div class='muted'>Players in room:</div>";

    for (const [id, player] of Object.entries(players)) {
        const playerItem = document.createElement("div");
        playerItem.className = "player-item";

        let playerText = `${player.symbol}`;
        if (player.isCreator) {
            playerText += ` <span class="creator-badge">Creator</span>`;
        }
        if (id === playerId) {
            playerText += " (You)";
        }

        playerItem.innerHTML = `
            <div class="player-dot"></div>
            <div>${playerText}</div>
        `;
        playerList.appendChild(playerItem);
    }

    // Show room full message if applicable
    isRoomFull = Object.keys(players).length >= 2;
    roomFullMessage.style.display = isRoomFull ? "block" : "none";
    deleteRoomBtn.style.display = isRoomCreator ? "block" : "none";
}

// Update connection status
function updateConnectionStatus(connected, message) {
    isConnected = connected;
    connectionDot.classList.toggle("connected", connected && onlineStatus);
    connectionStatus.textContent = onlineStatus ? message : "Offline - cannot connect to rooms";
}

// Custom alert function
function showAlert(message, showCancel = false) {
    alertMessage.textContent = message;
    alertButtonCancel.style.display = showCancel ? "inline-block" : "none";
    customAlert.style.display = "block";
    overlay.style.display = "block";
}

function hideAlert() {
    customAlert.style.display = "none";
    joinRequestAlert.style.display = "none";
    overlay.style.display = "none";
}

// Show join request alert
function showJoinRequestAlert(playerName, requestId) {
    joinRequestPlayerId = requestId;
    joinRequestMessage.textContent = `${playerName} wants to join your room.`;
    joinRequestAlert.style.display = "block";
    overlay.style.display = "block";
}

// Log messages to the log container
function log(message) {
    logEl.innerHTML += `<div>${message}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
}

// Toggle auto reset
function toggleAutoReset() {
    autoResetEnabled = autoResetToggle.checked;
    log(`Auto reset ${autoResetEnabled ? "enabled" : "disabled"}`);
}

// Render the game board
function renderBoard() {
    boardEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        if (board[i] === "X") cell.classList.add("x");
        if (board[i] === "O") cell.classList.add("o");

        // Disable cell if it's not player's turn in multiplayer
        if (isMultiplayer && isConnected && (currentPlayer !== mySymbol || gameOver || matchCompleted)) {
            cell.classList.add("disabled");
        }

        cell.textContent = board[i] || "";
        cell.addEventListener("click", () => handleCellClick(i));
        boardEl.appendChild(cell);
    }

    // Update UI
    turnLabel.textContent = currentPlayer;
    playerLabel.textContent = mySymbol || "—";
    updateStatusMessage();
}

// Update score display
function updateScoreUI() {
    scoreX.textContent = scores.X;
    scoreO.textContent = scores.O;
    roundsEl.textContent = `${rounds}/${maxRounds}`;
}

// Update status message
function updateStatusMessage() {
    if (!isMultiplayer) {
        statusMessage.textContent = "";
        statusMessage.className = "status-message";
        return;
    }

    if (!isConnected) {
        statusMessage.textContent = "Not connected to a room";
        statusMessage.className = "status-message status-waiting";
    } else if (matchCompleted) {
        statusMessage.textContent = "Match completed";
        statusMessage.className = "status-message";
    } else if (gameOver) {
        statusMessage.textContent = "Game over - ready for next round";
        statusMessage.className = "status-message";
    } else if (currentPlayer === mySymbol) {
        statusMessage.textContent = "Your turn!";
        statusMessage.className = "status-message status-active";
    } else {
        statusMessage.textContent = "Waiting for opponent...";
        statusMessage.className = "status-message status-waiting pulse";
    }
}

// Handle cell click
function handleCellClick(index) {
    if (gameOver || matchCompleted) {
        log("Game over - reset to play again");
        return;
    }

    if (board[index]) {
        log("Cell already taken!");
        return;
    }

    // Multiplayer checks
    if (isMultiplayer) {
        if (!isConnected) {
            log("You're not connected to a room yet");
            return;
        }

        if (mySymbol === null) {
            log("Waiting for player assignment...");
            return;
        }

        if (currentPlayer !== mySymbol) {
            log("It's not your turn! Waiting for opponent...");
            return;
        }

        if (Object.keys(players).length < 2) {
            log("Waiting for another player to join...");
            return;
        }
    }

    // Make the move
    board[index] = currentPlayer;
    renderBoard();

    // Update room state IMMEDIATELY after move in multiplayer
    if (isMultiplayer && isConnected) {
        // Switch turns first so the room state reflects correct next player
        const nextPlayer = currentPlayer === "X" ? "O" : "X";
        currentPlayer = nextPlayer;
        turnLabel.textContent = currentPlayer;
        updateStatusMessage();
        updateRoomState();
    }

    // Check for win or draw
    const result = checkWin();
    if (result) {
        if (result.winner === "draw") {
            log("It's a draw!");
            endRound("draw");
        } else {
            log(`Player ${result.winner} wins!`);
            highlightWinningCells(result.line);
            endRound(result.winner);
        }
    } else {
        // For non-multiplayer, switch turns here
        if (!isMultiplayer) {
            currentPlayer = currentPlayer === "X" ? "O" : "X";
            turnLabel.textContent = currentPlayer;
            updateStatusMessage();
        }

        // AI move if playing against computer
        if (!isMultiplayer && modeEl.value !== "friend" && currentPlayer === "O") {
            setTimeout(makeAIMove, 500);
        }
    }
}

// Update room state in Firebase
function updateRoomState() {
    if (!roomRef) return;

    roomRef.update({
        board: board,
        turn: currentPlayer,
        players: players,
        gameOver: gameOver,
        scores: scores,
        rounds: rounds,
        matchCompleted: matchCompleted,
        lastUpdated: Date.now()
    }).then(() => {
        log("Game state updated");
    }).catch((error) => {
        log("Error updating game: " + error.message);
    });
}

// Check for win or draw
function checkWin() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    // Check for win
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line: pattern };
        }
    }

    // Check for draw
    if (board.every(cell => cell !== null)) {
        return { winner: "draw", line: null };
    }

    // Game continues
    return null;
}

// Highlight winning cells
function highlightWinningCells(cells) {
    cells.forEach(index => {
        const cell = boardEl.children[index];
        cell.classList.add("win");
    });
}

// End the round
function endRound(winner) {
    gameOver = true;

    // Update scores
    if (winner !== "draw") {
        scores[winner]++;
        rounds++;
    }

    updateScoreUI();
    log(`Round ended: ${winner}`);

    // Check if match is over
    checkMatchCompletion();

    // Update room state in multiplayer
    if (isMultiplayer && isConnected) {
        updateRoomState();
    }

    updateStatusMessage();
}

// Check if match is completed
function checkMatchCompletion() {
    // Check if match is over
    if (rounds >= maxRounds || scores.X > maxRounds/2 || scores.O > maxRounds/2) {
        let matchWinnerText = "Draw";
        if (scores.X > scores.O) matchWinnerText = "X";
        if (scores.O > scores.X) matchWinnerText = "O";

        matchCompleted = true;
        matchWinner.style.display = "block";
        matchWinner.textContent = `Match finished! Winner: ${matchWinnerText}`;

        log(`Match finished! Winner: ${matchWinnerText}`);
        showAlert(`Match finished! Winner: ${matchWinnerText}`);
    } else {
        // Auto reset if enabled
        if (autoResetEnabled) {
            setTimeout(() => resetGame(), 2000);
        }
    }
}

// Reset the game
function resetGame() {
    // Don't reset if match is completed
    if (matchCompleted) {
        // Reset the entire match
        board = Array(9).fill(null);
        currentPlayer = "X";
        gameOver = false;
        scores = { X: 0, O: 0 };
        rounds = 0;
        matchCompleted = false;
        matchWinner.style.display = "none";
    } else {
        // Just reset the board for next round
        board = Array(9).fill(null);
        currentPlayer = "X";
        gameOver = false;
    }

    renderBoard();
    updateStatusMessage();

    // Update room state in multiplayer
    if (isMultiplayer && isConnected) {
        updateRoomState();
    }

    log("Game reset");
}

// AI move logic
function makeAIMove() {
    if (gameOver || matchCompleted) return;

    let move;
    if (modeEl.value === "easy") {
        // Easy AI - random move
        const emptyCells = board.map((cell, index) => cell === null ? index : null)
                                       .filter(index => index !== null);
        move = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    } else {
        // Hard AI - minimax algorithm
        move = findBestMove();
    }

    if (move !== undefined) {
        board[move] = "O";
        renderBoard();

        const result = checkWin();
        if (result) {
            if (result.winner === "draw") {
                log("It's a draw!");
                endRound("draw");
            } else {
                log(`Player ${result.winner} wins!`);
                highlightWinningCells(result.line);
                endRound(result.winner);
            }
        } else {
            currentPlayer = "X";
            turnLabel.textContent = currentPlayer;
            updateStatusMessage();
        }
    }
}

// Minimax algorithm for hard AI
function findBestMove() {
    let bestScore = -Infinity;
    let bestMove;

    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            board[i] = "O";
            let score = minimax(board, 0, false);
            board[i] = null;
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }

    return bestMove;
}

// Minimax helper function
function minimax(board, depth, isMaximizing) {
    const result = checkWin();

    if (result) {
        if (result.winner === "O") return 10 - depth;
        if (result.winner === "X") return depth - 10;
        return 0;
    }

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = "O";
                let score = minimax(board, depth + 1, false);
                board[i] = null;
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = "X";
                let score = minimax(board, depth + 1, true);
                board[i] = null;
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

// Handle mode change
function handleModeChange() {
    const mode = modeEl.value;
    modeLabel.textContent = modeEl.options[modeEl.selectedIndex].text;
    isMultiplayer = (mode === "multi");

    // Reset game when changing modes
    resetGame();

    // Show/hide multiplayer controls
    document.getElementById("roomInput").style.display = isMultiplayer ? "block" : "none";
    document.getElementById("joinBtn").style.display = isMultiplayer ? "block" : "none";
    document.getElementById("createBtn").style.display = isMultiplayer ? "block" : "none";

    // Clean up Firebase listeners if switching from multiplayer
    if (!isMultiplayer) {
        leaveRoom();
    }

    updateStatusMessage();
    log(`Mode changed to: ${mode}`);
}

// Create a multiplayer room
function createRoom() {
    if (!onlineStatus) {
        showAlert("You are offline — cannot create a room.");
        return;
    }

    if (!database) {
        showAlert("Firebase not configured. Please set up Firebase to use multiplayer features.");
        return;
    }

    // Don't reset the game when creating a room
    // Only reset multiplayer-specific state
    roomId = "room_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    mySymbol = "X";
    isRoomCreator = true;

    // Generate a unique player ID
    playerId = "player_" + Math.random().toString(36).substr(2, 9);

    // Add yourself as a player
    players = {
        [playerId]: {
            id: playerId,
            symbol: "X",
            isCreator: true,
            name: "Player " + Math.floor(Math.random() * 1000)
        }
    };

    // Create room in Firebase
    roomRef = database.ref('rooms/' + roomId);
    roomRef.set({
        board: board, // Use current board state
        turn: currentPlayer, // Use current turn
        players: players,
        gameOver: gameOver, // Use current game over state
        scores: scores, // Use current scores
        rounds: rounds, // Use current rounds
        maxRounds: maxRounds,
        matchCompleted: matchCompleted,
        roomName: "Room by " + players[playerId].name,
        createdAt: Date.now(),
        lastUpdated: Date.now()
    }).then(() => {
        log(`Room created: ${roomId}`);
        log("Share the link with your friend");

        // Set connection status to true
        isConnected = true;

        // Set up real-time listener for this room
        roomRef.on('value', (snapshot) => {
            const roomData = snapshot.val();
            if (roomData) {
                updateGameFromRoomData(roomData);
            } else {
                // Room was deleted
                log("Room was deleted by the creator");
                showAlert("Room was deleted by the creator");
                leaveRoom();
            }
        });

        // Set up join requests listener
        setupJoinRequestsListener();

        linkBox.textContent = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        copyLink.disabled = false;

        updateConnectionStatus(true, "Connected to room: " + roomId);
        updatePlayerList();
        updateStatusMessage();

        // Load rooms list to update the UI
        loadRoomsList();
    }).catch((error) => {
        log("Error creating room: " + error.message);
        showAlert("Error creating room: " + error.message);
    });
}

// Set up join requests listener
function setupJoinRequestsListener() {
    if (!roomId) return;

    joinRequestsRef = database.ref('joinRequests/' + roomId);
    joinRequestsRef.on('child_added', (snapshot) => {
        const request = snapshot.val();
        if (request && request.status === 'pending') {
            pendingRequests++;
            updateNotificationBadge();

            // Show notification if not already viewing requests
            if (!document.getElementById('browseTab').classList.contains('active')) {
                showJoinRequestAlert(request.playerName, snapshot.key);
            }
        }
    });

    // Also listen for removed requests
    joinRequestsRef.on('child_removed', (snapshot) => {
        pendingRequests = Math.max(0, pendingRequests - 1);
        updateNotificationBadge();
    });
}

// Join a multiplayer room
function joinRoom() {
    if (!onlineStatus) {
        showAlert("You are offline — cannot join a room.");
        return;
    }

    if (!database) {
        showAlert("Firebase not configured. Please set up Firebase to use multiplayer features.");
        return;
    }

    const roomCode = roomInput.value.trim();
    if (!roomCode) {
        log("Please enter a room code");
        showAlert("Please enter a room code");
        return;
    }

    // Check if room is already full
    database.ref('rooms/' + roomCode).once('value').then((snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) {
            log("Room not found");
            showAlert("Room not found. Please check the room code.");
            return;
        }

        if (roomData.players && Object.keys(roomData.players).length >= 2) {
            log("This room is already full");
            showAlert("This room is already full. Please create a new room or join a different one.");
            return;
        }

        // Don't reset the game when trying to join a room
        // Only reset multiplayer-specific state
        roomId = roomCode;

        // Generate a unique player ID
        playerId = "player_" + Math.random().toString(36).substr(2, 9);
        mySymbol = "O";
        isRoomCreator = false;

        // Send join request
        const playerName = "Player " + Math.floor(Math.random() * 1000);
        database.ref('joinRequests/' + roomId + '/' + playerId).set({
            playerName: playerName,
            status: 'pending',
            timestamp: Date.now()
        }).then(() => {
            log("Join request sent to room creator");
            showAlert("Join request sent. Waiting for approval...");

            // Listen for request response
            database.ref('joinRequests/' + roomId + '/' + playerId).on('value', (snapshot) => {
                const request = snapshot.val();
                if (!request) return;

                if (request.status === 'accepted') {
                    // Join the room
                    joinRoomAfterApproval(roomData, playerName);
                } else if (request.status === 'rejected') {
                    log("Your join request was rejected");
                    showAlert("Your join request was rejected");
                    database.ref('joinRequests/' + roomId + '/' + playerId).off();
                }
            });
        });
    }).catch((error) => {
        log("Error joining room: " + error.message);
        showAlert("Error joining room: " + error.message);
    });
}

// Join room after approval
function joinRoomAfterApproval(roomData, playerName) {
    // Add yourself as a player
    const updatedPlayers = {...roomData.players};
    updatedPlayers[playerId] = {
        id: playerId,
        symbol: "O",
        isCreator: false,
        name: playerName
    };

    // Update room with new player
    roomRef = database.ref('rooms/' + roomId);
    roomRef.update({
        players: updatedPlayers,
        lastUpdated: Date.now()
    }).then(() => {
        // Set connection status to true
        isConnected = true;

        // Set up real-time listener for this room
        roomRef.on('value', (snapshot) => {
            const roomData = snapshot.val();
            if (roomData) {
                updateGameFromRoomData(roomData);
            } else {
                // Room was deleted
                log("Room was deleted by the creator");
                showAlert("Room was deleted by the creator");
                leaveRoom();
            }
        });

        log(`Joined room: ${roomId}`);
        linkBox.textContent = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        copyLink.disabled = false;

        updateConnectionStatus(true, "Connected to room: " + roomId);
        updateStatusMessage();

        // Clean up join request
        database.ref('joinRequests/' + roomId + '/' + playerId).off();
        database.ref('joinRequests/' + roomId + '/' + playerId).remove();
    }).catch((error) => {
        log("Error joining room: " + error.message);
    });
}

// Accept join request
function acceptJoinRequest() {
    if (joinRequestPlayerId) {
        database.ref('joinRequests/' + roomId + '/' + joinRequestPlayerId).update({
            status: 'accepted'
        }).then(() => {
            log("Join request accepted");
            hideAlert();

            // Remove the request
            database.ref('joinRequests/' + roomId + '/' + joinRequestPlayerId).remove();

            pendingRequests--;
            updateNotificationBadge();
            joinRequestPlayerId = null;
        });
    }
}

// Reject join request
function rejectJoinRequest() {
    if (joinRequestPlayerId) {
        database.ref('joinRequests/' + roomId + '/' + joinRequestPlayerId).update({
            status: 'rejected'
        }).then(() => {
            log("Join request rejected");
            hideAlert();

            // Remove the request after a delay to allow the user to see the rejection
            setTimeout(() => {
                database.ref('joinRequests/' + roomId + '/' + joinRequestPlayerId).remove();
            }, 2000);

            pendingRequests--;
            updateNotificationBadge();
            joinRequestPlayerId = null;
        });
    }
}

// Update game state from room data - FIXED VERSION
function updateGameFromRoomData(roomData) {
    if (!roomData) return;

    // Store the previous state to detect changes
    const currentBoardState = JSON.stringify(board);

    // Update game state from room data
    board = roomData.board || Array(9).fill(null);
    currentPlayer = roomData.turn || "X";
    gameOver = roomData.gameOver || false;
    players = roomData.players || {};
    scores = roomData.scores || { X: 0, O: 0 };
    rounds = roomData.rounds || 0;
    maxRounds = roomData.maxRounds || 5;
    matchCompleted = roomData.matchCompleted || false;

    // Check if room is full
    isRoomFull = Object.keys(players).length >= 2;

    // Update bestOf selector if you're the creator
    if (isRoomCreator) {
        bestOfEl.value = maxRounds.toString();
    }

    // Check if board state changed
    const newBoardState = JSON.stringify(board);
    const boardChanged = currentBoardState !== newBoardState;

    // Always update UI when we receive room data
    renderBoard();
    updateScoreUI();
    updatePlayerList();
    updateStatusMessage();

    // Show match winner if completed
    if (matchCompleted) {
        let matchWinnerText = "Draw";
        if (scores.X > scores.O) matchWinnerText = "X";
        if (scores.O > scores.X) matchWinnerText = "O";

        matchWinner.style.display = "block";
        matchWinner.textContent = `Match finished! Winner: ${matchWinnerText}`;
    } else {
        matchWinner.style.display = "none";
    }

    // Check if there's a win to highlight
    if (gameOver) {
        const result = checkWin();
        if (result && result.line) {
            highlightWinningCells(result.line);
        }
    }

    if (boardChanged) {
        log("Room state updated - opponent made a move");
    }
}

// Leave the current room
function leaveRoom() {
    if (roomRef) {
        roomRef.off();
    }

    if (joinRequestsRef) {
        joinRequestsRef.off();
    }

    // If you're the creator, delete the room
    if (isRoomCreator && roomId) {
        database.ref('rooms/' + roomId).remove();
        database.ref('joinRequests/' + roomId).remove();
    } else if (playerId && roomId) {
        // Remove yourself from the room
        database.ref('rooms/' + roomId + '/players/' + playerId).remove();
    }

    // Reset multiplayer state
    isConnected = false;
    roomId = null;
    roomRef = null;
    joinRequestsRef = null;
    mySymbol = null;
    players = {};
    isRoomFull = false;
    playerId = null;
    isRoomCreator = false;
    joinRequestPlayerId = null;
    pendingRequests = 0;
    updateNotificationBadge();

    linkBox.textContent = "No active room";
    copyLink.disabled = true;
    deleteRoomBtn.style.display = "none";
    playerList.innerHTML = "";
    roomFullMessage.style.display = "none";

    updateConnectionStatus(false, "Not connected to a room");
    updateStatusMessage();

    log("Left the room");
}

// Delete room (creator only)
function deleteRoom() {
    if (isRoomCreator && roomId) {
        database.ref('rooms/' + roomId).remove();
        database.ref('joinRequests/' + roomId).remove();
        leaveRoom();
        log("Room deleted");
    }
}

// Update max rounds
function updateMaxRounds() {
    if (isMultiplayer && isConnected && !isRoomCreator) {
        log("Only the room creator can change the number of rounds");
        showAlert("Only the room creator can change the number of rounds");
        bestOfEl.value = maxRounds.toString(); // Revert the change
        return;
    }

    maxRounds = parseInt(bestOfEl.value);
    updateScoreUI();
    log(`Max rounds changed to: ${maxRounds}`);

    // Update room if in multiplayer mode
    if (isMultiplayer && isConnected && isRoomCreator) {
        roomRef.update({
            maxRounds: maxRounds,
            lastUpdated: Date.now()
        });
    }
}

// Toggle theme
function toggleTheme() {
    document.body.classList.toggle("light");
    log("Theme changed");
}

// Copy room link
function copyRoomLink() {
    navigator.clipboard.writeText(linkBox.textContent)
        .then(() => {
            log("Link copied to clipboard!");
        })
        .catch(err => {
            log("Failed to copy link: " + err);
        });
}

// Initialize the game when the page loads
window.addEventListener("DOMContentLoaded", init);