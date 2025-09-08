// Global balance management system for ScrapHouse
class BalanceManager {
    constructor() {
        this.userBalance = this.loadUserBalance();
        this.init();
    }

    // Load user balance from localStorage
    loadUserBalance() {
        try {
            const balance = localStorage.getItem('userBalance');
            return balance ? parseFloat(balance) : 0.00; // Default $0 starting balance
        } catch (error) {
            console.error('Error loading user balance:', error);
            return 0.00;
        }
    }

    // Save user balance to localStorage
    saveUserBalance() {
        try {
            localStorage.setItem('userBalance', this.userBalance.toString());
        } catch (error) {
            console.error('Error saving user balance:', error);
        }
    }

    // Get current user balance
    getUserBalance() {
        return this.userBalance;
    }

    // Deduct amount from user balance
    deductBalance(amount) {
        if (this.userBalance >= amount) {
            this.userBalance -= amount;
            this.saveUserBalance();
            this.updateBalanceDisplay();
            return true;
        }
        return false;
    }

    // Add amount to user balance (for winnings)
    addBalance(amount) {
        this.userBalance += amount;
        this.saveUserBalance();
        this.updateBalanceDisplay();
    }

    // Set balance to specific amount
    setBalance(amount) {
        this.userBalance = amount;
        this.saveUserBalance();
        this.updateBalanceDisplay();
    }

    // Update balance display in UI
    updateBalanceDisplay() {
        // Update all balance displays on the page
        const balanceElements = document.querySelectorAll('.balance-display, #userBalance');
        balanceElements.forEach(el => {
            if (el) {
                el.textContent = `$${this.userBalance.toFixed(2)}`;
            }
        });

        // Update balance in navigation if it exists
        const navBalance = document.querySelector('.balance span strong');
        if (navBalance) {
            navBalance.textContent = `$${this.userBalance.toFixed(2)}`;
        }
    }

    // Reset balance to zero
    resetBalance() {
        this.userBalance = 0.00;
        this.saveUserBalance();
        this.updateBalanceDisplay();
    }

    // Initialize balance display on page load
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updateBalanceDisplay();
            });
        } else {
            this.updateBalanceDisplay();
        }
    }
}

// Create global balance manager instance
window.balanceManager = new BalanceManager();
