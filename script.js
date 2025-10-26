// *******************************************************************
// ***** APNA FIREBASE CONFIG OBJECT YAHAAN PASTE KAREIN *****
// *******************************************************************
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
} catch (error) {
    console.error("Firebase initialization error:", error);
    document.getElementById('createTab').innerHTML = `<div class="status-message status-error">Firebase initialization failed.</div>`;
}

// DOM Elements
const boardEl = document.getElementById("board"), modeEl = document.getElementById("mode"), createBtn = document.getElementById("createBtn"),
    joinBtn = document.getElementById("joinBtn"), roomInput = document.getElementById("roomInput"), resetBtn = document.getElementById("resetBtn"),
    logEl = document.getElementById("log"), linkBox = document.getElementById("linkBox"), copyLink = document.getElementById("copyLink"),
    modeLabel = document.getElementById("modeLabel"), turnLabel = document.getElementById("turnLabel"), playerLabel = document.getElementById("playerLabel"),
    scoreX = document.getElementById("scoreX"), scoreO = document.getElementById("scoreO"), roundsEl = document.getElementById("rounds"),
    bestOfEl = document.getElementById("bestOf"), themeBtn = document.getElementById("themeBtn"), statusMessage = document.getElementById("statusMessage"),
    autoResetToggle = document.getElementById("autoReset"), customAlert = document.getElementById("customAlert"), overlay = document.getElementById("overlay"),
    alertMessage = document.getElementById("alertMessage"), alertButtonOk = document.getElementById("alertButtonOk"), connectionDot = document.getElementById("connectionDot"),
    connectionStatus = document.getElementById("connectionStatus"), playerList = document.getElementById("playerList"), roomFullMessage = document.getElementById("roomFullMessage"),
    deleteRoomBtn = document.getElementById("deleteRoomBtn"), roomList = document.getElementById("roomList"), prevPageBtn = document.getElementById("prevPageBtn"),
    nextPageBtn = document.getElementById("nextPageBtn"), pageInfo = document.getElementById("pageInfo"), tabs = document.querySelectorAll('.tab'),
    tabContents = document.querySelectorAll('.tab-content'), matchWinner = document.getElementById("matchWinner"), createRoomModal = document.getElementById("createRoomModal"),
    passwordModal = document.getElementById("passwordModal"), roomNameInput = document.getElementById("roomNameInput"), roomPasswordInput = document.getElementById("roomPasswordInput"),
    createRoomSubmitBtn = document.getElementById("createRoomSubmitBtn"), passwordPromptInput = document.getElementById("passwordPromptInput"),
    passwordSubmitBtn = document.getElementById("passwordSubmitBtn"), closeCreateModal = document.getElementById("closeCreateModal"),
    closePasswordModal = document.getElementById("closePasswordModal"), passwordError = document.getElementById("passwordError");

// Game state
let board = Array(9).fill(null), currentPlayer = "X", gameOver = false, scores = { X: 0, O: 0 }, rounds = 0,
    maxRounds = 5, mySymbol = null, roomId = null, isMultiplayer = true, autoResetEnabled = false, isConnected = false,
    players = {}, isRoomFull = false, playerId = null, isRoomCreator = false, currentPage = 1, roomsPerPage = 20,
    onlineStatus = navigator.onLine, matchCompleted = false, roomRef = null, roomsRef = null;

function init() {
    renderBoard();
    updateScoreUI();
    handleModeChange();
    modeEl.addEventListener("change", handleModeChange);
    joinBtn.addEventListener("click", joinRoom);
    resetBtn.addEventListener("click", resetGame);
    bestOfEl.addEventListener("change", updateMaxRounds);
    themeBtn.addEventListener("click", toggleTheme);
    copyLink.addEventListener("click", copyRoomLink);
    autoResetToggle.addEventListener("change", () => autoResetEnabled = autoResetToggle.checked);
    alertButtonOk.addEventListener("click", hideAlert);
    deleteRoomBtn.addEventListener("click", deleteRoom);
    prevPageBtn.addEventListener("click", () => changePage(-1));
    nextPageBtn.addEventListener("click", () => changePage(1));
    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.getAttribute('data-tab'))));
    createBtn.addEventListener("click", () => createRoomModal.style.display = "block");
    closeCreateModal.addEventListener("click", () => createRoomModal.style.display = "none");
    createRoomSubmitBtn.addEventListener("click", handleCreateRoomSubmit);
    closePasswordModal.addEventListener("click", () => passwordModal.style.display = "none");
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) { roomInput.value = roomParam; modeEl.value = "multi"; handleModeChange(); }
    window.addEventListener('online', () => onlineStatus = true);
    window.addEventListener('offline', () => onlineStatus = false);
    loadRoomsList();
}

function switchTab(tabId) {
    tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tabId));
    tabContents.forEach(c => c.classList.toggle('active', c.id === tabId + 'Tab'));
    if (tabId === 'browse') loadRoomsList();
}

function showAlert(message) {
    alertMessage.textContent = message;
    customAlert.style.display = "block";
    overlay.style.display = "block";
}
function hideAlert() {
    customAlert.style.display = "none";
    overlay.style.display = "none";
}
function log(message) { logEl.innerHTML += `<div>${message}</div>`; logEl.scrollTop = logEl.scrollHeight; }

function renderBoard() {
    boardEl.innerHTML = "";
    board.forEach((val, i) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        if (val) cell.classList.add(val.toLowerCase());
        if (isMultiplayer && isConnected && (currentPlayer !== mySymbol || gameOver || matchCompleted)) {
            cell.classList.add("disabled");
        }
        cell.textContent = val || "";
        cell.addEventListener("click", () => handleCellClick(i));
        boardEl.appendChild(cell);
    });
    turnLabel.textContent = currentPlayer;
    playerLabel.textContent = mySymbol || "—";
    updateStatusMessage();
}

function updateScoreUI() {
    scoreX.textContent = scores.X;
    scoreO.textContent = scores.O;
    maxRounds = parseInt(bestOfEl.value);
    roundsEl.textContent = `${rounds}/${maxRounds}`;
}

function updateStatusMessage() {
    if (!isMultiplayer) { statusMessage.textContent = ""; return; }
    let msg = "Not connected to a room", cls = "status-waiting";
    if (isConnected) {
        if (matchCompleted) { msg = "Match completed"; cls = ""; }
        else if (gameOver) { msg = "Game over - ready for next round"; cls = ""; }
        else if (Object.keys(players).length < 2) { msg = `Waiting for player... (${roomId})`; cls = "status-waiting"; }
        else if (currentPlayer === mySymbol) { msg = "Your turn!"; cls = "status-active"; }
        else { msg = "Waiting for opponent..."; cls = "status-waiting"; }
    }
    statusMessage.textContent = msg;
    statusMessage.className = `status-message ${cls}`;
}

function handleCellClick(index) {
    if (gameOver || matchCompleted || board[index]) return;
    if (isMultiplayer) {
        if (!isConnected || currentPlayer !== mySymbol || Object.keys(players).length < 2) {
            log("Cannot play now. Waiting for opponent or not your turn.");
            return;
        }
    }
    
    board[index] = currentPlayer;
    renderBoard(); // Render immediately for responsiveness

    const result = checkWin();
    if (result) {
        gameOver = true;
        if (result.winner === "draw") {
            endRound("draw");
        } else {
            highlightWinningCells(result.line);
            endRound(result.winner);
        }
    } else {
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        if (!isMultiplayer && modeEl.value !== "friend" && currentPlayer === "O") {
            setTimeout(makeAIMove, 500);
        }
    }
    
    if (isMultiplayer) updateRoomState();
    renderBoard(); // Re-render to update turn/status
}

function updateRoomState() {
    if (!roomRef) return;
    roomRef.update({ board, turn: currentPlayer, gameOver, scores, rounds, matchCompleted });
}

function checkWin() {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line };
    }
    if (board.every(cell => cell)) return { winner: "draw", line: null };
    return null;
}
function highlightWinningCells(cells) { cells.forEach(i => boardEl.children[i].classList.add("win")); }

function endRound(winner) {
    gameOver = true;
    if (winner !== "draw") {
        scores[winner]++;
    }
    rounds++; // Always increment round counter
    updateScoreUI();
    log(`Round ended: ${winner}`);
    checkMatchCompletion();
    if (isMultiplayer && isConnected) updateRoomState();
}

function checkMatchCompletion() {
    if (scores.X > maxRounds / 2 || scores.O > maxRounds / 2 || rounds >= maxRounds) {
        let winnerText = scores.X > scores.O ? "X" : (scores.O > scores.X ? "O" : "Draw");
        matchCompleted = true;
        matchWinner.textContent = `Match finished! Winner: ${winnerText}`;
        matchWinner.style.display = "block";
        showAlert(`Match finished! Winner: ${winnerText}`);
    } else if (autoResetEnabled) {
        setTimeout(() => resetGame(false), 2000);
    }
}

function resetGame(fullReset = true) {
    board.fill(null);
    currentPlayer = "X";
    gameOver = false;
    if (fullReset || matchCompleted) { // Also do a full reset if the match was completed
        scores = { X: 0, O: 0 };
        rounds = 0;
        matchCompleted = false;
        matchWinner.style.display = "none";
        updateScoreUI();
    }
    renderBoard();
    updateStatusMessage();
    if (isMultiplayer && isConnected) updateRoomState();
    log("Game reset");
}

function makeAIMove() {
    if (gameOver) return;
    const emptyCells = board.map((cell, i) => cell === null ? i : null).filter(i => i !== null);
    if (emptyCells.length === 0) return;
    const move = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    handleCellClick(move);
}

function handleModeChange() {
    const mode = modeEl.value;
    modeLabel.textContent = modeEl.options[modeEl.selectedIndex].text;
    isMultiplayer = (mode === "multi");
    resetGame(true);
    document.getElementById("createTab").style.display = isMultiplayer ? "block" : "none";
    if (!isMultiplayer) leaveRoom();
    updateStatusMessage();
}

async function handleCreateRoomSubmit() {
    if (!onlineStatus) { showAlert("You are offline."); return; }
    const roomName = roomNameInput.value.trim() || 'Anonymous Room';
    const password = roomPasswordInput.value;
    const newRoomId = await generateUniqueRoomId();
    if (!newRoomId) { showAlert("Could not create a unique room. Please try again."); return; }
    createRoom(newRoomId, roomName, password);
    createRoomModal.style.display = 'none';
}

async function generateUniqueRoomId() {
    let newId, attempts = 0;
    while (attempts < 10) {
        newId = Math.floor(10000 + Math.random() * 90000).toString();
        const snapshot = await database.ref('rooms/' + newId).once('value');
        if (!snapshot.exists()) return newId;
        attempts++;
    }
    return null;
}

function createRoom(newRoomId, roomName, password) {
    roomId = newRoomId; mySymbol = "X"; isRoomCreator = true;
    playerId = "player_" + Math.random().toString(36).substr(2, 9);
    players = { [playerId]: { id: playerId, symbol: "X", isCreator: true } };
    roomRef = database.ref('rooms/' + roomId);
    roomRef.set({
        board: Array(9).fill(null), turn: "X", players, gameOver: false, scores: { X: 0, O: 0 }, rounds: 0,
        maxRounds: parseInt(bestOfEl.value), matchCompleted: false, roomName, password, createdAt: Date.now()
    }).then(() => {
        log(`Room created: ${roomId}`);
        roomInput.value = roomId;
        isConnected = true;
        setupRoomListeners();
        linkBox.textContent = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        copyLink.disabled = false;
        updateConnectionStatus(true, "Connected to room: " + roomId);
        updatePlayerList(); updateStatusMessage();
    });
}

function joinRoom() {
    if (!onlineStatus) { showAlert("You are offline."); return; }
    const roomCode = roomInput.value.trim();
    if (!/^\d{5}$/.test(roomCode)) { showAlert("Please enter a valid 5-digit room code."); return; }
    database.ref('rooms/' + roomCode).once('value').then(snapshot => {
        const roomData = snapshot.val();
        if (!roomData) { showAlert("Room not found."); return; }
        if (roomData.players && Object.keys(roomData.players).length >= 2) { showAlert("This room is already full."); return; }
        if (roomData.password) {
            promptForPassword(roomCode, roomData);
        } else {
            proceedToJoin(roomCode, roomData);
        }
    });
}

function promptForPassword(roomCode, roomData) {
    passwordModal.style.display = "block";
    passwordError.style.display = "none";
    passwordPromptInput.value = "";
    const handlePasswordSubmit = () => {
        if (passwordPromptInput.value === roomData.password) {
            passwordModal.style.display = "none";
            proceedToJoin(roomCode, roomData);
        } else {
            passwordError.textContent = "Incorrect password.";
            passwordError.style.display = "block";
        }
    };
    passwordSubmitBtn.addEventListener('click', handlePasswordSubmit, { once: true });
}

function proceedToJoin(roomCode, roomData) {
    roomId = roomCode; mySymbol = "O"; isRoomCreator = false;
    playerId = "player_" + Math.random().toString(36).substr(2, 9);
    const updatedPlayers = { ...roomData.players, [playerId]: { id: playerId, symbol: "O", isCreator: false } };
    roomRef = database.ref('rooms/' + roomId);
    roomRef.update({ players: updatedPlayers }).then(() => {
        isConnected = true;
        setupRoomListeners();
        log(`Joined room: ${roomId}`);
        linkBox.textContent = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        copyLink.disabled = false;
        updateConnectionStatus(true, "Connected to room: " + roomId);
    });
}

function setupRoomListeners() {
    roomRef.on('value', snapshot => {
        if (snapshot.exists()) {
            updateGameFromRoomData(snapshot.val());
        } else {
            showAlert("Room was deleted.");
            leaveRoom();
        }
    });
}

function updateGameFromRoomData(data) {
    const normBoard = Array(9).fill(null);
    if (data.board) {
        for (let i = 0; i < 9; i++) normBoard[i] = data.board[i] || null;
    }
    board = normBoard;
    currentPlayer = data.turn || "X";
    gameOver = data.gameOver || false;
    players = data.players || {};
    scores = data.scores || { X: 0, O: 0 };
    rounds = data.rounds || 0;
    maxRounds = data.maxRounds || 5;
    matchCompleted = data.matchCompleted || false;
    isRoomFull = Object.keys(players).length >= 2;
    if (!isRoomCreator) bestOfEl.value = maxRounds.toString();
    renderBoard(); updateScoreUI(); updatePlayerList(); updateStatusMessage();
    if (matchCompleted) {
        let winnerText = scores.X > scores.O ? "X" : scores.O > scores.X ? "O" : "Draw";
        matchWinner.textContent = `Match finished! Winner: ${winnerText}`;
        matchWinner.style.display = "block";
    } else {
        matchWinner.style.display = "none";
    }
    if (gameOver) {
        const res = checkWin();
        if (res && res.line) highlightWinningCells(res.line);
    }
}

function leaveRoom() {
    if (roomRef) roomRef.off();
    if (isRoomCreator && roomId) {
        database.ref('rooms/' + roomId).remove();
    } else if (playerId && roomId) {
        database.ref(`rooms/${roomId}/players/${playerId}`).remove();
    }
    isConnected = false; roomId = null; roomRef = null; mySymbol = null; players = {}; isRoomFull = false;
    playerId = null; isRoomCreator = false;
    linkBox.textContent = "No active room"; copyLink.disabled = true; deleteRoomBtn.style.display = "none";
    playerList.innerHTML = ""; roomFullMessage.style.display = "none";
    updateConnectionStatus(false, "Not connected");
    log("Left the room");
}

function deleteRoom() {
    if (isRoomCreator && roomId) {
        leaveRoom();
        log("Room deleted");
    }
}

function updateMaxRounds() {
    maxRounds = parseInt(bestOfEl.value);
    updateScoreUI();
    if (isMultiplayer && isConnected && isRoomCreator) {
        roomRef.update({ maxRounds });
    }
}
function toggleTheme() { document.body.classList.toggle("light"); }
function copyRoomLink() { navigator.clipboard.writeText(linkBox.textContent).then(() => log("Link copied!")); }

function loadRoomsList() {
    if (!database) return;
    roomList.innerHTML = "<div class='loader'></div>";
    if (roomsRef) roomsRef.off();
    roomsRef = database.ref('rooms');
    roomsRef.orderByChild('createdAt').limitToLast(100).on('value', (snapshot) => {
        const rooms = snapshot.val() || {};
        const roomsArray = Object.keys(rooms)
            .map(id => ({ id, ...rooms[id] }))
            .filter(r => r.players && Object.keys(r.players).length < 2)
            .reverse();
        
        const startIndex = (currentPage - 1) * roomsPerPage;
        const paginatedRooms = roomsArray.slice(startIndex, startIndex + roomsPerPage);

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = roomsArray.length <= currentPage * roomsPerPage;
        pageInfo.textContent = `Page ${currentPage}`;

        if (paginatedRooms.length === 0) {
            roomList.innerHTML = "<div class='status-message'>No rooms available. Create one!</div>";
            return;
        }

        roomList.innerHTML = '';
        paginatedRooms.forEach(room => {
            const playerCount = Object.keys(room.players).length;
            const isPrivate = room.password && room.password !== '';
            const lockIcon = isPrivate ? '<span class="lock-icon">🔒</span>' : '';
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            roomItem.innerHTML = `
                <div class="room-info">
                    <div>${room.roomName || 'Unnamed Room'} ${lockIcon}</div>
                    <div class="muted">Players: ${playerCount}/2 • Code: ${room.id}</div>
                </div>
                <div class="room-actions">
                    <button class="primary join-room-btn" data-room="${room.id}">Join</button>
                </div>
            `;
            roomList.appendChild(roomItem);
        });

        document.querySelectorAll('.join-room-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.getAttribute('data-room');
                roomInput.value = roomId;
                joinRoom();
                switchTab('create');
            });
        });
    });
}
function updatePlayerList() {
    playerList.innerHTML = "<div class='muted'>Players:</div>";
    Object.entries(players).forEach(([id, p]) => {
        const item = document.createElement("div");
        item.className = "player-item";
        let text = `${p.symbol}`;
        if (p.isCreator) text += ` <span class="creator-badge">Creator</span>`;
        if (id === playerId) text += " (You)";
        item.innerHTML = `<div class="player-dot"></div><div>${text}</div>`;
        playerList.appendChild(item);
    });
    roomFullMessage.style.display = isRoomFull ? "block" : "none";
    deleteRoomBtn.style.display = isRoomCreator ? "block" : "none";
}
function updateConnectionStatus(connected, message) {
    isConnected = connected;
    connectionDot.classList.toggle("connected", connected);
    connectionStatus.textContent = message;
}
function changePage(dir) {
    currentPage = Math.max(1, currentPage + dir);
    loadRoomsList();
}

window.addEventListener("DOMContentLoaded", init);