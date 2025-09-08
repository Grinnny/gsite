// Shared deposit calculator functionality for all crypto deposit pages

class DepositCalculator {
    constructor(cryptoSymbol) {
        this.cryptoSymbol = cryptoSymbol.toUpperCase();
        this.exchangeRates = {};
        this.loadExchangeRates();
    }

    async loadExchangeRates() {
        try {
            const response = await fetch('/exchangeRates');
            const data = await response.json();
            if (data.success) {
                this.exchangeRates = data.rates;
            }
        } catch (error) {
            console.error('Error loading exchange rates:', error);
        }
    }

    async calculateDeposit(amount) {
        if (!amount || amount <= 0) {
            throw new Error('Please enter a valid amount');
        }

        try {
            const response = await fetch('/calculateDeposit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cryptoAmount: amount,
                    cryptoSymbol: this.cryptoSymbol
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            return data;
        } catch (error) {
            throw new Error('Error calculating deposit: ' + error.message);
        }
    }

    displayResult(data, resultElementId) {
        const resultDiv = document.getElementById(resultElementId);
        const usdValueElement = resultDiv.querySelector('[data-usd-value]');
        const bonusAmountElement = resultDiv.querySelector('[data-bonus-amount]');
        const totalCreditElement = resultDiv.querySelector('[data-total-credit]');

        if (usdValueElement) usdValueElement.textContent = '$' + data.usdValue;
        if (bonusAmountElement) bonusAmountElement.textContent = '$' + data.bonusAmount;
        if (totalCreditElement) totalCreditElement.textContent = '$' + data.totalCredit;

        resultDiv.style.display = 'block';
    }

    hideResult(resultElementId) {
        const resultDiv = document.getElementById(resultElementId);
        resultDiv.style.display = 'none';
    }

    getMinimumAmount() {
        const rate = this.exchangeRates[this.cryptoSymbol];
        if (rate) {
            return (5 / rate).toFixed(8);
        }
        return '0.001';
    }

    updateMinimumDisplay(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = `${this.getMinimumAmount()} ${this.cryptoSymbol} (≈$5.00 USD)`;
        }
    }
}

// Generic function to create deposit calculator UI
function createDepositCalculatorHTML(cryptoSymbol, inputId, resultId) {
    return `
        <div style="background-color: #424242; border-radius: 10px; padding: 15px; border-left: 4px solid #4ECCA3; margin-bottom: 15px;">
            <h4 style="color: #4ECCA3; font-family: sansation; font-size: 16px; margin-bottom: 15px;">💰 Deposit Calculator (25% BONUS!)</h4>
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <input type="number" id="${inputId}" placeholder="0.001" step="0.00000001" min="0" 
                       style="background-color: #363636; border: 1px solid #555; border-radius: 6px; padding: 8px; color: white; font-family: sansation; flex: 1;">
                <span style="color: white; font-family: sansation; display: flex; align-items: center; padding: 0 10px;">${cryptoSymbol}</span>
            </div>
            <button onclick="calculate${cryptoSymbol}Deposit()" style="background-color: #4ECCA3; color: white; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-family: sansation; width: 100%;">
                Calculate Deposit + Bonus
            </button>
            <div id="${resultId}" style="margin-top: 15px; display: none;">
                <div style="background-color: #363636; border-radius: 6px; padding: 10px;">
                    <p style="color: #b9b9b9; font-family: sansation; margin: 5px 0;">USD Value: <span data-usd-value style="color: white;"></span></p>
                    <p style="color: #b9b9b9; font-family: sansation; margin: 5px 0;">25% Bonus: <span data-bonus-amount style="color: #4ECCA3;"></span></p>
                    <p style="color: #b9b9b9; font-family: sansation; margin: 5px 0; border-top: 1px solid #555; padding-top: 5px;"><strong>Total Credit: <span data-total-credit style="color: #4ECCA3;"></span></strong></p>
                </div>
            </div>
        </div>
    `;
}

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show success feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '#4ECCA3';
        }, 2000);
    });
}
