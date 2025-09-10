class GameVerifier {
    constructor() {
        this.init();
    }

    init() {
        const verifyBtn = document.getElementById('verifyBtn');
        const hashInput = document.getElementById('hashInput');
        const showHashesBtn = document.getElementById('showHashesBtn');
        
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => this.verifyGame());
        }
        
        if (hashInput) {
            hashInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.verifyGame();
                }
            });
            
            // Format input as user types
            hashInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toLowerCase().replace(/[^a-f0-9]/g, '');
            });
        }
        
        if (showHashesBtn) {
            showHashesBtn.addEventListener('click', () => this.showRecentHashes());
        }
    }

    async showRecentHashes() {
        const gameHistory = await this.loadGameHistory();
        const recentHashesDiv = document.getElementById('recentHashes');
        const hashListDiv = document.getElementById('hashList');
        
        if (gameHistory.length === 0) {
            hashListDiv.innerHTML = '<p style="color: #ff6b6b;">No game history available</p>';
        } else {
            const hashItems = gameHistory.slice(0, 10).map((game, index) => {
                return `
                    <div style="margin: 5px 0; padding: 8px; background: rgba(33, 33, 33, 0.5); border-radius: 4px; cursor: pointer;" 
                         onclick="document.getElementById('hashInput').value = '${game.hash}'; document.getElementById('recentHashes').style.display = 'none';">
                        <strong>Game ${index + 1}:</strong> ${game.hash}<br>
                        <small style="color: #4ECCA3;">Winner: ${game.winner?.name || 'Unknown'} | Pot: $${game.totalPot || 0}</small>
                    </div>
                `;
            }).join('');
            
            hashListDiv.innerHTML = hashItems;
        }
        
        recentHashesDiv.style.display = recentHashesDiv.style.display === 'none' ? 'block' : 'none';
    }

    async verifyGame() {
        const hashInput = document.getElementById('hashInput');
        const hash = hashInput.value.trim().toLowerCase();
        
        if (!hash) {
            this.showError('Please enter a game hash');
            return;
        }
        
        if (hash.length !== 64) {
            this.showError('Game hash must be 64 characters (full hash)');
            return;
        }
        
        // Show loading message
        this.showError('Loading game data...');
        
        // Load game history from server
        const gameHistory = await this.loadGameHistory();
        console.log('Loaded game history:', gameHistory);
        console.log('Number of games:', gameHistory.length);
        console.log('Looking for hash:', hash);
        
        // Log all available hashes for debugging
        console.log('Available hashes:');
        gameHistory.forEach((g, index) => {
            console.log(`${index}: ${g.hash} (ID: ${g.id})`);
        });
        
        const game = gameHistory.find(g => {
            console.log('Checking game:', g.id, 'hash:', g.hash, 'match:', g.hash === hash);
            return g.hash === hash;
        });
        
        if (!game) {
            this.showError('Game not found. This hash may be from a different device or an invalid hash.');
            return;
        }
        
        // Check if game has secret (all completed games should have secrets)
        if (!game.secret) {
            this.showError('Game secret not available. The game may not be completed or data is corrupted.');
            return;
        }
        
        this.displayGameDetails(game);
    }

    async loadGameHistory() {
        try {
            // First try to load from server API
            const response = await fetch('/api/game-history');
            const data = await response.json();
            
            if (data.success && Array.isArray(data.history)) {
                // Also save to localStorage as backup
                localStorage.setItem('jackpotHistory', JSON.stringify(data.history));
                return data.history;
            }
            
            // Fallback to localStorage if server fails
            const localHistory = localStorage.getItem('jackpotHistory');
            return localHistory ? JSON.parse(localHistory) : [];
        } catch (error) {
            console.error('Error loading game history:', error);
            // Fallback to localStorage
            try {
                const localHistory = localStorage.getItem('jackpotHistory');
                return localHistory ? JSON.parse(localHistory) : [];
            } catch (localError) {
                console.error('Error loading local history:', localError);
                return [];
            }
        }
    }

    displayGameDetails(game) {
        this.hideError();
        
        const resultContainer = document.getElementById('resultContainer');
        const gameDetails = document.getElementById('gameDetails');
        const secretReveal = document.getElementById('secretReveal');
        const playersList = document.getElementById('playersList');
        
        // Show result container
        resultContainer.style.display = 'block';
        
        // Populate game details with better fallback logic
        let gameEndDate = 'Unknown';
        if (game.endTime) {
            gameEndDate = new Date(game.endTime).toLocaleString();
        } else if (game.timestamp) {
            // If no endTime, use timestamp as approximation
            gameEndDate = new Date(game.timestamp).toLocaleString();
        }
        
        let gameStartDate = 'Unknown';
        if (game.gameInfo?.timestamp) {
            gameStartDate = new Date(game.gameInfo.timestamp).toLocaleString();
        } else if (game.startTime) {
            gameStartDate = new Date(game.startTime).toLocaleString();
        } else if (game.timestamp) {
            // Use game timestamp as fallback for start time
            const startTime = new Date(game.timestamp);
            startTime.setMinutes(startTime.getMinutes() - 5); // Assume 5 min game duration
            gameStartDate = startTime.toLocaleString();
        }
        
        let playerCount = 0;
        if (game.players && Array.isArray(game.players)) {
            playerCount = game.players.length;
        } else if (game.playersCount && game.playersCount > 0) {
            playerCount = game.playersCount;
        } else if (game.totalPot && game.totalPot > 0) {
            // Estimate players based on pot size (assuming average bet of $10)
            playerCount = Math.max(1, Math.ceil(game.totalPot / 10));
        } else {
            playerCount = 1; // Minimum 1 player if game exists
        }
        
        gameDetails.innerHTML = `
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Game Hash</h4>
                <p style="font-family: 'Courier New', monospace; color: white; font-size: 18px;">${game.hash}</p>
            </div>
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Total Pot</h4>
                <p style="font-family: iceberg; color: white; font-size: 18px;">$${game.totalPot.toFixed(2)}</p>
            </div>
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Players</h4>
                <p style="font-family: sansation; color: white; font-size: 18px;">${playerCount} total</p>
            </div>
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Winner</h4>
                <p style="font-family: sansation; color: white; font-size: 18px;">${game.winner ? game.winner.name : 'Unknown'}</p>
            </div>
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Game Started</h4>
                <p style="font-family: sansation; color: white; font-size: 18px;">${gameStartDate}</p>
            </div>
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Game Ended</h4>
                <p style="font-family: sansation; color: white; font-size: 18px;">${gameEndDate}</p>
            </div>
        `;
        
        // Reveal secret
        secretReveal.innerHTML = `
            <h4 style="font-family: sansation; margin-bottom: 15px;">Game Secret</h4>
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 5px; word-break: break-all;">
                ${game.secret}
            </div>
            <p style="font-size: 14px; margin-top: 15px; opacity: 0.8;">
                This secret was generated before the game started and can be used to verify the game's fairness.
            </p>
        `;
        
        // Display player betting history
        if (game.players && game.players.length > 0) {
            const playersHtml = game.players.map(player => {
                const winPercentage = ((player.betAmount / game.totalPot) * 100).toFixed(2);
                const isWinner = game.winner && game.winner.id === player.id;
                
                return `
                    <div class="player-item ${isWinner ? 'winner-highlight' : ''}">
                        <div>
                            <span style="font-family: sansation; color: white; font-weight: bold;">
                                ${player.name} ${isWinner ? '👑' : ''}
                            </span>
                        </div>
                        <div>
                            <span style="font-family: iceberg; color: #4ECCA3; margin-right: 15px;">
                                $${player.betAmount.toFixed(2)}
                            </span>
                            <span style="font-family: sansation; color: #b9b9b9;">
                                ${winPercentage}% chance
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
            
            playersList.innerHTML = `
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 15px;">Player Betting History</h4>
                <div style="margin-bottom: 15px;">
                    <p style="font-family: sansation; color: #b9b9b9; font-size: 14px;">
                        Total Players: <strong style="color: white;">${playerCount}</strong> | 
                        Total Pot: <strong style="color: #4ECCA3;">$${game.totalPot.toFixed(2)}</strong>
                    </p>
                </div>
                ${playersHtml}
            `;
        } else {
            playersList.innerHTML = `
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 15px;">Player Betting History</h4>
                <div style="background: rgba(66, 66, 66, 0.5); padding: 20px; border-radius: 8px; text-align: center;">
                    <p style="font-family: sansation; color: #b9b9b9; font-size: 16px;">
                        No detailed player data available for this game
                    </p>
                    <p style="font-family: sansation; color: white; font-size: 14px; margin-top: 10px;">
                        Total Players: <strong>${playerCount}</strong>
                    </p>
                </div>
            `;
        }
        
        // Scroll to results
        resultContainer.scrollIntoView({ behavior: 'smooth' });
    }

    showError(message) {
        const errorEl = document.getElementById('errorMessage');
        const resultContainer = document.getElementById('resultContainer');
        
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }
    }

    hideError() {
        const errorEl = document.getElementById('errorMessage');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameVerifier();
});
