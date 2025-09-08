class GameVerifier {
    constructor() {
        this.init();
    }

    init() {
        const verifyBtn = document.getElementById('verifyBtn');
        const hashInput = document.getElementById('hashInput');
        
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
    }

    verifyGame() {
        const hashInput = document.getElementById('hashInput');
        const hash = hashInput.value.trim().toLowerCase();
        
        if (!hash) {
            this.showError('Please enter a game hash');
            return;
        }
        
        if (hash.length !== 8) {
            this.showError('Game hash must be exactly 8 characters');
            return;
        }
        
        // Load game history from localStorage
        const gameHistory = this.loadGameHistory();
        const game = gameHistory.find(g => g.hash === hash);
        
        if (!game) {
            this.showError('Game not found. This hash may be from a different device or an invalid hash.');
            return;
        }
        
        if (!game.secretRevealed) {
            this.showError('Game secret not yet revealed. The game may still be in progress or not completed.');
            return;
        }
        
        this.displayGameDetails(game);
    }

    loadGameHistory() {
        try {
            const history = localStorage.getItem('jackpotHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error loading game history:', error);
            return [];
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
        
        // Populate game details
        const gameDate = new Date(game.endTime).toLocaleString();
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
                <p style="font-family: sansation; color: white; font-size: 18px;">${game.playersCount} Total</p>
            </div>
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Winner</h4>
                <p style="font-family: sansation; color: white; font-size: 18px;">${game.winner ? game.winner.name : 'Unknown'}</p>
            </div>
            <div class="detail-item">
                <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 10px;">Game Ended</h4>
                <p style="font-family: sansation; color: white; font-size: 18px;">${gameDate}</p>
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
        
        // Display players list
        const playersHtml = game.players.map(player => {
            const winPercentage = ((player.betAmount / game.totalPot) * 100).toFixed(2);
            const isWinner = game.winner && game.winner.id === player.id;
            
            return `
                <div class="player-item ${isWinner ? 'winner-highlight' : ''}">
                    <div>
                        <span style="font-family: sansation; color: white; font-weight: bold;">
                            ${player.name} ${isWinner ? '👑' : ''}
                        </span>
                        <span style="font-family: sansation; color: #b9b9b9; margin-left: 10px;">
                            (Player)
                        </span>
                    </div>
                    <div>
                        <span style="font-family: iceberg; color: #4ECCA3; margin-right: 15px;">
                            $${player.betAmount.toFixed(2)}
                        </span>
                        <span style="font-family: sansation; color: #b9b9b9;">
                            ${winPercentage}%
                        </span>
                    </div>
                </div>
            `;
        }).join('');
        
        playersList.innerHTML = `
            <h4 style="font-family: sansation; color: #4ECCA3; margin-bottom: 15px;">Players & Bets</h4>
            ${playersHtml}
        `;
        
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
