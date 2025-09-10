// Jackpot Game Logic - Client Side
class JackpotGame {
    constructor() {
        this.useRealtime = typeof window !== 'undefined' && !!window.socket; // use Socket.IO if present
        this.currentGame = {
            id: null,
            players: [],
            totalPot: 0,
            isActive: false,
            startTime: null,
            endTime: null,
            winner: null,
            countdown: 60 // 60 seconds countdown
        };
        
        this.gameHistory = this.loadGameHistory();
        this.countdownInterval = null;
        this.spinner = null;
        this.botJoinTimers = [];
        // Track the first real player who joined this round to ensure consistent rigging on client
        this.firstRealPlayerId = null;
        this.botNames = [
            'Alex_Gaming', 'Mike_CS', 'Sarah_Pro', 'David_Trader', 'Emma_Skins',
            'Jake_Winner', 'Lisa_Lucky', 'Ryan_Beast', 'Anna_Fire', 'Tom_Legend',
            'Sophia_Ace', 'Chris_Master', 'Maya_Sharp', 'Luke_Flash', 'Zoe_Clutch',
            'Noah_Strike', 'Ava_Sniper', 'Ethan_Rush', 'Mia_Bomb', 'Owen_Knife'
        ];
        
        this.init();
    }

    // Use global balance manager
    getUserBalance() {
        return window.balanceManager ? window.balanceManager.getUserBalance() : 0;
    }

    deductBalance(amount) {
        return window.balanceManager ? window.balanceManager.deductBalance(amount) : false;
    }

    addBalance(amount) {
        if (window.balanceManager) {
            window.balanceManager.addBalance(amount);
        }
    }

    updateBalanceDisplay() {
        if (window.balanceManager) {
            window.balanceManager.updateBalanceDisplay();
        }
    }

    init() {
        this.loadGameHistory();

        // Initialize spinner after a short delay to ensure DOM is ready
        setTimeout(() => {
            console.log('🎲 Initializing JackpotSpinner...');
            this.spinner = new JackpotSpinner('jackpotSpinner');
            console.log('✅ Spinner created:', !!this.spinner);
            
            // Check if we're recovering from a page refresh during spinning
            this.checkForSpinnerRecovery();
            
            this.updateSpinner();
        }, 100);

        // Initialize balance display
        this.updateBalanceDisplay();

        if (this.useRealtime) {
            // Realtime: subscribe to server events and do not run local timers
            const socket = window.socket;
            socket.on('game_state', (state) => {
                this.currentGame.id = state.id || this.currentGame.id;
                this.currentGame.players = (state.players || []).map(p => ({ 
                    ...p, 
                    avatar: p.avatar // Use the avatar from server directly, don't override it
                }));
                this.currentGame.totalPot = state.totalPot || 0;
                this.currentGame.isActive = !!state.isActive;
                this.currentGame.startTime = state.startTime || null;
                this.currentGame.countdown = typeof state.countdown === 'number' ? state.countdown : this.currentGame.countdown;
                this.currentGame.hash = state.hash;
                
                // Clear spinner segments when new empty round starts
                if (this.spinner && state.players && state.players.length === 0) {
                    console.log('🧹 Clearing spinner segments for empty pot');
                    this.spinner.segments = [];
                    this.spinner.winner = null;
                    this.spinner.forceReset(); // Use force reset to clear any stuck state
                    this.spinner.draw();
                    // Reset client-side rigging for new round
                    this.firstRealPlayerId = null;
                    this.spinner.predeterminedWinner = null;
                    this.spinner.forceWinner = null;
                }
                
                // Update spinner with new players if they exist
                if (this.spinner && state.players && state.players.length > 0) {
                    this.spinner.updateSegments(this.currentGame.players);
                }
                // Load persisted history if provided by server
                if (Array.isArray(state.history)) {
                    this.gameHistory = state.history.map(h => ({
                        hash: h.hash,
                        secret: h.secret,
                        totalPot: h.totalPot || 0,
                        winner: h.winner || null,
                        secretRevealed: true,
                        time: h.time,
                    }));
                    // Keep local cap of 50 entries as well
                    if (this.gameHistory.length > 50) this.gameHistory = this.gameHistory.slice(0, 50);
                    localStorage.setItem('jackpotHistory', JSON.stringify(this.gameHistory));
                    this.updateHistory();
                }
                this.updateUI();
                this.updateCountdownDisplay();
            });

            socket.on('player_joined', ({ player, totalPot }) => {
                const enriched = { ...player }; // Keep all player data including avatar as-is from server
                this.currentGame.players.push(enriched);
                this.currentGame.totalPot = totalPot;
                
                // CLIENT-SIDE RIGGING HOOK: when a real player joins first, lock them as predetermined winner
                if (!enriched.isBot) {
                    if (!this.firstRealPlayerId) {
                        this.firstRealPlayerId = enriched.id;
                        console.log('🎯 CLIENT RIGGING: First real player joined:', enriched.name, enriched.id);
                        if (this.spinner && !this.spinner.predeterminedWinner) {
                            this.spinner.predeterminedWinner = enriched;
                            this.spinner.forceWinner = enriched;
                            console.log('✅ CLIENT RIGGING: Set spinner.predeterminedWinner to first real player');
                        }
                    } else {
                        console.log('ℹ️ CLIENT RIGGING: Real player joined but first real already set to', this.firstRealPlayerId);
                    }
                }
                
                this.updateUI();
                this.updateSpinner();
                this.updateCountdownDisplay();
            });

            socket.on('pot_updated', ({ totalPot }) => {
                this.currentGame.totalPot = totalPot;
                this.updateGameInfo();
            });

            socket.on('countdown_tick', ({ secondsLeft }) => {
                this.currentGame.countdown = secondsLeft;
                this.updateCountdownDisplay();
            });

            socket.on('spinner_start', ({ players, forcedWinner, preciseVelocity, targetRotation }) => {
                console.log('📡 Received spinner_start event');
                console.log('🔍 CLIENT DEBUG: forcedWinner received:', forcedWinner);
                console.log('🔍 CLIENT DEBUG: preciseVelocity received:', preciseVelocity);
                console.log('🔍 CLIENT DEBUG: targetRotation received:', targetRotation);
                
                if (this.spinner) {
                    console.log('🎲 Current spinner segments:', this.spinner.segments.length);
                    
                    if (forcedWinner && (preciseVelocity || targetRotation)) {
                        // Use server-calculated precise velocity
                        console.log('🎯 Using server-calculated velocity for real player:', forcedWinner.name);
                        console.log('🎰 Server velocity:', preciseVelocity);
                        this.spinner.forceWinner = forcedWinner;
                        this.spinner.predeterminedWinner = forcedWinner;
                        this.spinner.serverVelocity = preciseVelocity;
                        this.spinner.serverTargetRotation = targetRotation || null;
                        console.log('✅ CLIENT: Set predeterminedWinner to:', this.spinner.predeterminedWinner.name);
                    } else if (forcedWinner) {
                        // Fallback to client calculation
                        console.log('🎯 Forcing spinner to land on real player (client calc):', forcedWinner.name);
                        this.spinner.forceWinner = forcedWinner;
                        this.spinner.predeterminedWinner = forcedWinner;
                        this.spinner.serverVelocity = null;
                        this.spinner.serverTargetRotation = null;
                        console.log('✅ CLIENT: Set predeterminedWinner to:', this.spinner.predeterminedWinner.name);
                    } else {
                        // Let physics decide (only bots in round)
                        console.log('🎲 Letting physics decide winner (bots only)');
                        this.spinner.forceWinner = null;
                        this.spinner.predeterminedWinner = null;
                        this.spinner.serverVelocity = null;
                        this.spinner.serverTargetRotation = null;
                    }
                    
                    this.spinner.spin();
                } else {
                    console.error('❌ Cannot start spinner - spinner not initialized');
                }
            });

            socket.on('round_result', (entry) => {
                console.log('📡 Received round_result with winner:', entry.winner?.name);
                
                // IMPORTANT: Don't overwrite spinner winner - spinner is authoritative
                // Only update if spinner hasn't determined a winner yet
                if (!this.spinner || !this.spinner.winner) {
                    this.currentGame.winner = entry.winner;
                    console.log('⚠️ Using server winner as fallback:', entry.winner?.name);
                } else {
                    // Keep spinner winner - it's the authoritative source
                    console.log('🎯 Keeping spinner winner as authoritative:', this.spinner.winner.name);
                    this.currentGame.winner = this.spinner.winner;
                }
                
                this.currentGame.isActive = false;
                this.currentGame.secret = entry.secret;
                this.currentGame.hash = entry.hash;
                this.currentGame.gameInfo = entry.gameInfo;
                this.currentGame.id = entry.id;
                
                // No popup - just store the data for history
                
                const historyEntry = {
                    id: entry.id,
                    hash: entry.hash,
                    secret: entry.secret,
                    totalPot: entry.totalPot,
                    winner: this.currentGame.winner, // Use the spinner-determined winner
                    secretRevealed: true,
                    players: this.currentGame.players,
                    gameInfo: entry.gameInfo,
                    endTime: entry.endTime
                };
                this.gameHistory.unshift(historyEntry);
                if (this.gameHistory.length > 50) this.gameHistory.pop();
                localStorage.setItem('jackpotHistory', JSON.stringify(this.gameHistory));

                // Award local balance if real player won
                if (this.currentGame.winner && !this.currentGame.winner.isBot) {
                    this.addBalance(entry.totalPot || 0);
                }

                // Show winner animation with correct winner
                this.showWinnerAnimation();
                this.updateHistory();
                
                // Reset client-side rigging state for next round
                this.firstRealPlayerId = null;
                if (this.spinner) {
                    this.spinner.predeterminedWinner = null;
                    this.spinner.forceWinner = null;
                }
            });

            // Load history on demand
            socket.on('join_game_error', ({ error }) => {
                this.showError(error);
                // Don't automatically redirect - let user decide
            });

            socket.on('history_update', ({ history }) => {
                if (Array.isArray(history)) {
                    this.gameHistory = history.map(h => ({
                        hash: h.hash,
                        secret: h.secret,
                        totalPot: h.totalPot || 0,
                        winner: h.winner || null,
                        secretRevealed: true,
                        time: h.time,
                    }));
                    if (this.gameHistory.length > 50) this.gameHistory = this.gameHistory.slice(0, 50);
                    localStorage.setItem('jackpotHistory', JSON.stringify(this.gameHistory));
                    this.updateHistory();
                }
            });

            // Request full history once listeners are attached
            socket.emit('request_history');

            // Do an initial UI refresh
            this.updateUI();
        } else {
            // Local fallback (single-user)
            const savedGame = this.loadCurrentGameState();
            if (savedGame && savedGame.isActive) {
                this.currentGame = savedGame;
                this.updateUI();
                this.startCountdown();
            } else {
                this.updateUI();
                this.startNewGame();
            }
        }
    }

    // Generate random bot players
    generateBotPlayers() {
        // Determine jackpot size category
        const jackpotType = Math.random();
        let numBots, betRange;
        
        if (jackpotType < 0.15) {
            // 15% chance: Small jackpot ($30-$99)
            numBots = Math.floor(Math.random() * 3) + 2; // 2-4 bots
            betRange = { min: 8, max: 25 }; // $8-$25 bets
        } else {
            // 85% chance: Large jackpot ($100-$300)
            numBots = Math.floor(Math.random() * 6) + 4; // 4-9 bots
            betRange = { min: 15, max: 45 }; // $15-$45 bets
        }
        
        const bots = [];
        
        for (let i = 0; i < numBots; i++) {
            const betAmount = Math.floor(Math.random() * (betRange.max - betRange.min + 1)) + betRange.min;
            const botName = this.botNames[Math.floor(Math.random() * this.botNames.length)];
            
            bots.push({
                id: `bot_${Date.now()}_${i}`,
                name: botName + Math.floor(Math.random() * 1000),
                betAmount: betAmount,
                isBot: true,
                avatar: player.avatar || 'imgs/bot-avatar.png'
            });
        }
        
        return bots;
    }

    // Schedule bots to join gradually over time
    scheduleBotsToJoin() {
        const bots = this.generateBotPlayers();
        
        bots.forEach((bot, index) => {
            // More frequent joining - spread over first 50 seconds with clustering
            let joinTime;
            
            if (index < 2) {
                // First 2 bots join early (0-10 seconds)
                joinTime = Math.random() * 10000;
            } else if (index < 4) {
                // Next 2 bots join in middle (10-30 seconds)
                joinTime = Math.random() * 20000 + 10000;
            } else {
                // Remaining bots join later (20-50 seconds)
                joinTime = Math.random() * 30000 + 20000;
            }
            
            const timer = setTimeout(() => {
                if (this.currentGame.isActive) {
                    this.addPlayer(bot);
                }
            }, joinTime);
            
            this.botJoinTimers.push(timer);
        });
    }

    // Clear all bot join timers
    clearBotTimers() {
        this.botJoinTimers.forEach(timer => clearTimeout(timer));
        this.botJoinTimers = [];
    }

    // Generate game hash and secret
    generateGameCredentials() {
        const secret = this.generateRandomString(32);
        const hash = this.hashString(secret);
        return { hash, secret };
    }

    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString(16);
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    // Start a new jackpot game
    startNewGame() {
        if (this.useRealtime) return; // server drives rounds
        
        // Clear any existing countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        const credentials = this.generateGameCredentials();
        
        this.currentGame = {
            hash: credentials.hash,
            secret: credentials.secret,
            players: [],
            totalPot: 0,
            isActive: true,
            startTime: Date.now(),
            endTime: null,
            winner: null,
            countdown: 60,
            secretRevealed: false
        };

        // Clear any existing bot timers
        this.clearBotTimers();

        // Reset spinner for new game
        if (this.spinner) {
            this.spinner.reset();
        }

        // Reset join button
        this.resetJoinButton();

        // Schedule bots to join gradually instead of instantly
        if (!this.useRealtime) this.scheduleBotsToJoin();

        this.updateUI();
        this.updateSpinner();
        
        // Don't start countdown yet - wait for minimum players
        this.checkMinimumPlayersAndStart();
    }

    // Add a player to the current game
    addPlayer(player) {
        if (!this.currentGame.isActive) return false;

        const betAmount = parseFloat(player.betAmount) || 0;
        
        // For real players (not bots), check balance and deduct funds
        if (!player.isBot) {
            if (betAmount <= 0) {
                this.showError('Please enter a valid bet amount');
                return false;
            }
            
            if (!this.deductBalance(betAmount)) {
                this.showError(`Insufficient funds! You need $${betAmount.toFixed(2)} but only have $${this.getUserBalance().toFixed(2)}`);
                return false;
            }
        }

        // Ensure player has required properties
        const newPlayer = {
            id: player.id || `player_${Date.now()}`,
            name: player.name || 'Anonymous',
            betAmount: betAmount,
            isBot: player.isBot || false,
            avatar: player.avatar || 'imgs/user-circle.png'
        };

        this.currentGame.players.push(newPlayer);
        this.currentGame.totalPot += newPlayer.betAmount;
        
        this.updateUI();
        this.updateSpinner();
        this.saveGameState(); // Save state when player joins
        
        // Check if we now have enough players to start countdown
        this.checkMinimumPlayersAndStart();
        
        return true;
    }

    // Show error message to user
    showError(message) {
        // Try to use the auth error message display first
        const authErrorDiv = document.getElementById('authErrorMessage');
        const authErrorText = document.getElementById('authErrorText');
        
        if (authErrorDiv && authErrorText) {
            authErrorText.textContent = message;
            authErrorDiv.classList.remove('hidden');
            setTimeout(() => {
                authErrorDiv.classList.add('hidden');
            }, 5000);
            return;
        }
        
        // Fallback to general error message
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    calculateWinPercentages() {
        if (this.currentGame.totalPot === 0) return [];

        return this.currentGame.players.map((player, index) => ({
            ...player,
            winPercentage: (player.betAmount / this.currentGame.totalPot * 100).toFixed(2),
            color: this.spinner ? this.spinner.colors[index % this.spinner.colors.length] : '#4ECCA3'
        }));
    }

    // Check if we have minimum players and start countdown if ready
    checkMinimumPlayersAndStart() {
        const minPlayers = 2;
        
        if (this.currentGame.players.length >= minPlayers) {
            // We have enough players, start the countdown if not already started
            if (!this.countdownInterval && this.currentGame.countdown === 60) {
                console.log(`✅ Minimum ${minPlayers} players reached. Starting countdown!`);
                this.startCountdown();
            }
        } else {
            // Not enough players yet
            console.log(`⏳ Waiting for players... (${this.currentGame.players.length}/${minPlayers})`);
            this.updateCountdownDisplay(); // Update UI to show waiting message
        }
    }

    // Start countdown timer
    startCountdown() {
        if (this.useRealtime) return; // server sends countdown_tick
        
        // Clear any existing countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Reset countdown to 60 if it's at 0 or negative
        if (this.currentGame.countdown <= 0) {
            this.currentGame.countdown = 60;
        }
        
        this.countdownInterval = setInterval(() => {
            this.currentGame.countdown--;
            this.updateCountdownDisplay();
            this.saveGameState(); // Save state every second during countdown
            
            if (this.currentGame.countdown <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    // End the current game
    endGame() {
        if (this.useRealtime) return; // server ends games
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        // Clear any remaining bot timers
        this.clearBotTimers();

        this.currentGame.isActive = false;
        this.currentGame.endTime = Date.now();

        // Clear saved game state since game is ending
        localStorage.removeItem('currentJackpotGame');

        // Start the physics-based spinner
        if (this.spinner && this.currentGame.players.length > 0) {
            this.spinner.spin();
            // Winner will be determined when spinner stops naturally
        } else {
            // No players or no spinner - no winner
            this.currentGame.winner = null;
            this.saveGameToHistory();
            setTimeout(() => {
                this.showWinnerAnimation();
            }, 1000);
            setTimeout(() => {
                this.startNewGame();
            }, 6000);
        }
    }

    // Save game to local history
    saveGameToHistory() {
        // Award winnings to real player if they won
        if (this.currentGame.winner && !this.currentGame.winner.isBot) {
            this.addBalance(this.currentGame.totalPot);
            console.log(`💰 Player won $${this.currentGame.totalPot.toFixed(2)}! Balance updated.`);
        }
        
        // Reveal the secret when saving to history
        const gameToSave = {
            ...this.currentGame,
            secretRevealed: true,
            playersCount: this.currentGame.players.length,
            realPlayersCount: this.currentGame.players.filter(p => !p.isBot).length
        };
        
        this.gameHistory.unshift(gameToSave);
        
        // Keep only last 50 games
        if (this.gameHistory.length > 50) {
            this.gameHistory = this.gameHistory.slice(0, 50);
        }
        
        localStorage.setItem('jackpotHistory', JSON.stringify(this.gameHistory));
    }

    // Load game history from localStorage
    loadGameHistory() {
        const saved = localStorage.getItem('jackpotHistory');
        return saved ? JSON.parse(saved) : [];
    }

    // Join game as real player
    joinGame(betAmount) {
        // Check if user is logged in first
        if (!authManager || !authManager.isLoggedIn) {
            this.showError('You must be logged in to join games! Please login with Steam to continue.');
            return false;
        }

        if (!this.currentGame.isActive) {
            alert('No active game to join!');
            return false;
        }

        if (betAmount < 1) {
            alert('Minimum bet is $1.00');
            return false;
        }
        if (this.useRealtime) {
            // Deduct locally, then emit to server
            if (!this.deductBalance(betAmount)) {
                this.showError(`Insufficient funds! You need $${betAmount.toFixed(2)} but only have $${this.getUserBalance().toFixed(2)}`);
                return false;
            }
            const payload = {
                id: `real_${Date.now()}`,
                name: 'You',
                betAmount: parseFloat(betAmount),
                isBot: false,
            };
            window.socket.emit('join_game', payload);
            return true;
        }

        // Local fallback behavior
        // Find existing real player or create new entry
        let existingPlayer = this.currentGame.players.find(p => !p.isBot && p.name === 'You');
        
        if (existingPlayer) {
            // Add to existing bet amount
            existingPlayer.betAmount += parseFloat(betAmount);
            existingPlayer.totalBets = (existingPlayer.totalBets || 1) + 1;
        } else {
            // Create new player entry
            const player = {
                id: `real_player_${Date.now()}`,
                name: 'You',
                betAmount: parseFloat(betAmount),
                isBot: false,
                avatar: 'imgs/user-circle.png',
                totalBets: 1
            };
            this.addPlayer(player);
        }

        // Update total pot and UI
        this.currentGame.totalPot = this.currentGame.players.reduce((sum, p) => sum + p.betAmount, 0);
        this.updateUI();
        this.updateSpinner();
        this.saveGameState();
        return true;
    }

    // Check if we need to recover from a page refresh during spinning
    checkForSpinnerRecovery() {
        if (!this.spinner) return;
        
        // Check if there was a spinning state before refresh
        const wasSpinning = localStorage.getItem('spinnerWasSpinning');
        if (wasSpinning === 'true') {
            console.log('🔄 Detected spinner was active before page refresh - forcing reset');
            this.spinner.forceReset();
            localStorage.removeItem('spinnerWasSpinning');
        }
    }
    
    // Save current game state to localStorage
    saveGameState() {
        const gameStateToSave = {
            ...this.currentGame,
            savedAt: Date.now()
        };
        localStorage.setItem('currentJackpotGame', JSON.stringify(gameStateToSave));
        
        // Track if spinner is currently active
        if (this.spinner && this.spinner.isSpinning) {
            localStorage.setItem('spinnerWasSpinning', 'true');
        } else {
            localStorage.removeItem('spinnerWasSpinning');
        }
    }

    // Load current game state from localStorage
    loadCurrentGameState() {
        try {
            const saved = localStorage.getItem('currentJackpotGame');
            if (!saved) return null;
            
            const gameState = JSON.parse(saved);
            
            // Check if saved game is too old (more than 10 minutes)
            const maxAge = 10 * 60 * 1000; // 10 minutes
            if (Date.now() - gameState.savedAt > maxAge) {
                localStorage.removeItem('currentJackpotGame');
                return null;
            }
            
            // Calculate remaining countdown time
            const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
            const remainingCountdown = Math.max(0, 60 - elapsed);
            
            // If countdown expired, don't restore
            if (remainingCountdown <= 0) {
                localStorage.removeItem('currentJackpotGame');
                return null;
            }
            
            gameState.countdown = remainingCountdown;
            return gameState;
        } catch (error) {
            console.error('Error loading game state:', error);
            localStorage.removeItem('currentJackpotGame');
            return null;
        }
    }

    // Reset join button for new game
    resetJoinButton() {
        const joinBtn = document.getElementById('joinGameBtn');
        if (joinBtn) {
            joinBtn.disabled = false;
            joinBtn.textContent = 'Join Game';
            joinBtn.style.backgroundColor = '#4ECCA3';
            joinBtn.classList.remove('bg-gray-600');
        }
    }

    // Update spinner with current players
    updateSpinner() {
        if (this.spinner) {
            this.spinner.updatePlayers(this.currentGame.players);
        }
    }

    // Update UI elements
    updateUI() {
        this.updateGameInfo();
        this.updatePlayersList();
        this.updateHistory();
    }

    // Update game information display
    updateGameInfo() {
        const gameInfoEl = document.getElementById('gameInfo');
        if (gameInfoEl) {
            const shortHash = this.currentGame.hash ? this.currentGame.hash.substring(0, 8) : '';
            gameInfoEl.innerHTML = `
                <div class="text-center">
                    <h2 style="font-family: carving; color: #4ECCA3; font-size: 28px;" class="mb-2">Game Hash: ${shortHash}</h2>
                    <div style="font-family: iceberg; color: #4ECCA3; font-size: 48px;" class="font-bold mb-2">$${this.currentGame.totalPot.toFixed(2)}</div>
                    <div style="font-family: sansation; color: #b9b9b9; font-size: 18px;">${this.currentGame.players.length} Players</div>
                </div>
            `;
        }
    }

    // Update countdown display
    updateCountdownDisplay() {
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            const minPlayers = 2;
            
            if (this.currentGame.players.length < minPlayers) {
                // Show waiting for players message
                countdownEl.innerHTML = `
                    <div style="font-family: sansation; color: #4ECCA3; font-size: 24px;">
                        Waiting for Players<br>
                        <span style="font-size: 18px; color: #b9b9b9;">
                            ${this.currentGame.players.length}/${minPlayers} joined
                        </span>
                    </div>
                `;
                countdownEl.className = 'text-center animate-pulse';
            } else {
                // Ensure countdown doesn't go below 0
                const displayCountdown = Math.max(0, this.currentGame.countdown);
                
                // Show normal countdown
                countdownEl.textContent = displayCountdown;
                
                // Change color based on time remaining
                if (displayCountdown <= 10) {
                    countdownEl.className = 'text-6xl font-bold text-red-500 animate-pulse';
                } else if (displayCountdown <= 30) {
                    countdownEl.className = 'text-6xl font-bold text-yellow-500';
                } else {
                    countdownEl.className = 'text-6xl font-bold text-green-500';
                }
            }
        }
    }

    // Update players list display
    updatePlayersList() {
        const playersListEl = document.getElementById('playersList');
        if (playersListEl) {
            const playersWithPercentages = this.calculateWinPercentages();
            
            playersListEl.innerHTML = playersWithPercentages.map((player, index) => {
                // Generate a unique color for each player based on their index
                const colors = [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
                    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
                ];
                const playerColor = colors[index % colors.length];
                
                return `
                <div style="background-color: #424242; border-radius: 10px; border: 1px solid #363636;" class="flex items-center justify-between p-3 mb-2">
                    <div class="flex items-center">
                        <div class="relative mr-3">
                            <img src="${player.avatar}" alt="${player.name}" class="w-10 h-10 rounded-full">
                            <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white" style="background-color: ${playerColor};"></div>
                        </div>
                        <div>
                            <div style="font-family: sansation; color: white;" class="font-medium">
                                ${player.profileUrl ? `<a href="${player.profileUrl}" target="_blank" style="color: white; text-decoration: none; cursor: pointer;" onmouseover="this.style.color='#4ECCA3'" onmouseout="this.style.color='white'">${player.name}</a>` : player.name}
                            </div>
                            <div style="font-family: sansation; color: #b9b9b9;" class="text-sm">Player</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div style="font-family: iceberg; color: #4ECCA3;" class="font-bold">$${player.betAmount.toFixed(2)}</div>
                        <div style="font-family: sansation; color: #b9b9b9;" class="text-sm">${player.winPercentage}%</div>
                    </div>
                </div>
                `;
            }).join('');
        }
    }

    // Update game history display
    showGameVerification(gameData) {
        // Create verification modal
        const modal = document.createElement('div');
        modal.className = 'verification-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #2a2a2a;
            border-radius: 15px;
            padding: 30px;
            max-width: 600px;
            width: 90%;
            color: white;
            font-family: 'Sansation', sans-serif;
        `;

        const gameInfo = gameData.gameInfo || {};
        content.innerHTML = `
            <h2 style="color: #4ECCA3; margin-bottom: 20px; text-align: center;">🎯 Game Verification</h2>
            
            <div style="background: #363636; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="color: #4ECCA3; margin-bottom: 15px;">Game Information</h3>
                <p><strong>Game ID:</strong> ${gameData.id}</p>
                <p><strong>Total Pot:</strong> $${gameData.totalPot.toFixed(2)}</p>
                <p><strong>Winner:</strong> ${gameData.winner.name} (${gameInfo.winnerType || 'unknown'})</p>
                <p><strong>Players:</strong> ${gameInfo.playerCount || gameData.players?.length || 0} total</p>
                <p><strong>End Time:</strong> ${new Date(gameInfo.endTime || Date.now()).toLocaleString()}</p>
            </div>

            <div style="background: #363636; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="color: #4ECCA3; margin-bottom: 15px;">Provably Fair Verification</h3>
                <p><strong>Pre-Game Hash:</strong></p>
                <p style="font-family: monospace; background: #222; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${gameData.hash}</p>
                
                <p style="margin-top: 15px;"><strong>Post-Game Secret:</strong></p>
                <p style="font-family: monospace; background: #222; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${gameData.secret}</p>
                
                <p style="margin-top: 15px; color: #4ECCA3;"><strong>✅ Hash Verification:</strong> SHA256(secret) = hash</p>
                <p style="font-size: 14px; color: #bbb;">You can verify this game's fairness by computing SHA256 of the secret and comparing it to the pre-revealed hash.</p>
                <p style="margin-top: 10px; font-size: 12px; color: #888;">Truncated Hash for Verification: <span style="font-family: monospace; color: #4ECCA3;">${gameData.hash ? gameData.hash.substring(0, 8) : 'N/A'}</span></p>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="window.open('/verify-game/${gameData.id}', '_blank')" 
                        style="background: #4ECCA3; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-family: 'Sansation';">
                    View Full Verification
                </button>
                <button onclick="this.closest('.verification-modal').remove()" 
                        style="background: #666; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-family: 'Sansation';">
                    Close
                </button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Auto-close after 10 seconds
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 10000);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    updateHistory() {
        const historyContainer = document.getElementById('gameHistory');
        if (!historyContainer) return;

        historyContainer.innerHTML = '';
        this.gameHistory.forEach(game => {
            const historyItem = document.createElement('div');
            historyItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                margin-bottom: 8px;
                background-color: #2a2a2a;
                border-radius: 8px;
                border: 1px solid #424242;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: sansation;
            `;
            historyItem.onmouseover = () => {
                historyItem.style.backgroundColor = '#363636';
                historyItem.style.borderColor = '#4ECCA3';
            };
            historyItem.onmouseout = () => {
                historyItem.style.backgroundColor = '#2a2a2a';
                historyItem.style.borderColor = '#424242';
            };
            
            historyItem.innerHTML = `
                <div style="color: #4ECCA3; font-weight: bold; font-size: 16px;">$${game.totalPot.toFixed(2)}</div>
                <div style="color: white; flex: 1; text-align: center;">${game.winner.name}</div>
                <div style="color: #b9b9b9; font-size: 12px; font-family: monospace;" title="Click to verify game fairness">${game.hash ? game.hash.substring(0, 8) + '...' : 'N/A'}</div>
            `;
            
            // Add click handler to show verification modal
            historyItem.addEventListener('click', () => {
                if (game.hash && game.secret) {
                    this.showGameVerification(game);
                }
            });
            
            historyContainer.appendChild(historyItem);
        });
        
        // Show "No games yet" message if history is empty
        if (this.gameHistory.length === 0) {
            historyContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #b9b9b9; font-family: sansation;">
                    No games played yet. Join a game to see history!
                </div>
            `;
        }
    }

    // Show winner animation
    showWinnerAnimation() {
        const winnerEl = document.getElementById('winnerDisplay');
        
        // Always prioritize spinner winner - it's the authoritative source
        let winner = this.currentGame.winner;
        if (this.spinner && this.spinner.winner) {
            winner = this.spinner.winner;
            console.log('🎯 Using spinner winner for animation:', winner.name);
        }
        
        if (winnerEl && winner) {
            console.log('🎉 Showing winner animation for:', winner.name);
            winnerEl.innerHTML = `
                <div class="text-center p-8 bg-gradient-to-r from-green-600 to-green-800 rounded-lg">
                    <h2 style="font-family: carving; color: white; font-size: 36px;" class="mb-4">🎉 WINNER! 🎉</h2>
                    <div style="font-family: sansation; color: white; font-size: 24px;" class="mb-2">${winner.name}</div>
                    <div style="font-family: iceberg; color: #4ECCA3; font-size: 32px;" class="font-bold">Won $${this.currentGame.totalPot.toFixed(2)}</div>
                </div>
            `;
            
            winnerEl.classList.remove('hidden');
            
            // Hide after 8 seconds
            setTimeout(() => {
                winnerEl.classList.add('hidden');
            }, 8000);
        }
    }
}

// Initialize jackpot game when page loads
let jackpotGame;

document.addEventListener('DOMContentLoaded', function() {
    jackpotGame = new JackpotGame();
    window.jackpotGame = jackpotGame; // Make it globally accessible for spinner
    
    // Setup join game button
    const joinBtn = document.getElementById('joinGameBtn');
    const betInput = document.getElementById('betAmount');
    
    if (joinBtn && betInput) {
        joinBtn.addEventListener('click', function() {
            const betAmount = parseFloat(betInput.value);
            if (jackpotGame.joinGame(betAmount)) {
                betInput.value = '';
                // Don't disable button - allow multiple joins
                // Show temporary feedback
                const originalText = joinBtn.textContent;
                joinBtn.textContent = 'Joined!';
                setTimeout(() => {
                    joinBtn.textContent = originalText;
                }, 1500);
            }
        });
    }

    // Show/hide Steam login warning based on authentication status
    function updateSteamLoginWarning() {
        const warningDiv = document.getElementById('steamLoginWarning');
        if (warningDiv) {
            if (!authManager || !authManager.isLoggedIn) {
                warningDiv.classList.remove('hidden');
            } else {
                warningDiv.classList.add('hidden');
            }
        }
    }

    // Update warning on page load and auth state changes
    updateSteamLoginWarning();
    
    // Listen for auth state changes
    if (authManager) {
        const originalReplaceUserIcon = authManager.replaceUserIcon;
        authManager.replaceUserIcon = function() {
            originalReplaceUserIcon.call(this);
            updateSteamLoginWarning();
        };
    }
});
