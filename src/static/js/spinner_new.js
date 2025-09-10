// Jackpot Spinner - Physics-based spinning wheel with guaranteed rigging
class JackpotSpinner {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.players = [];
        this.segments = [];
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
        ];
        
        // Spinner physics
        this.rotation = 0;
        this.velocity = 0;
        this.friction = 0.995;
        this.isSpinning = false;
        this.minVelocity = 0.0005;
        this.startingRotation = 0;
        
        // Animation
        this.animationId = null;
        this.winner = null;
        this.winnerAnimation = {
            active: false,
            progress: 0,
            duration: 2000,
            startTime: 0,
            winnerColor: null,
            winnerData: null
        };
        
        // Rigging system
        this.forceWinner = null;
        this.predeterminedWinner = null;
        this.serverVelocity = null;
        
        // Canvas setup
        this.setupCanvas();
        this.draw();
        
        // Avatar cache
        this.avatarCache = new Map();
    }
    
    setupCanvas() {
        this.canvas.width = 400;
        this.canvas.height = 400;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = 150;
    }
    
    updatePlayers(players) {
        this.players = players;
        this.createSegments();
        this.draw();
    }
    
    createSegments() {
        this.segments = [];
        if (this.players.length === 0) return;
        
        const totalBets = this.players.reduce((sum, player) => sum + player.betAmount, 0);
        let currentAngle = 0;
        
        this.players.forEach((player, index) => {
            const percentage = (player.betAmount / totalBets) * 100;
            const segmentAngle = (percentage / 100) * 2 * Math.PI;
            
            this.segments.push({
                player: player,
                startAngle: currentAngle,
                endAngle: currentAngle + segmentAngle,
                color: this.colors[index % this.colors.length],
                percentage: percentage
            });
            
            currentAngle += segmentAngle;
        });
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.segments.length === 0) {
            this.drawEmptyWheel();
            return;
        }
        
        // Draw segments
        this.segments.forEach(segment => {
            this.drawSegment(segment);
        });
        
        // Draw center circle
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 30, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#1A202C';
        this.ctx.fill();
        this.ctx.strokeStyle = '#4A5568';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // Draw pointer
        this.drawPointer();
        
        // Draw winner animation if active
        if (this.winnerAnimation && this.winnerAnimation.active) {
            this.drawWinnerAnimation();
        }
        
        // Draw player labels if no winner animation
        if (this.segments.length > 0 && !this.winnerAnimation.active) {
            this.drawLabels();
        }
    }
    
    drawSegment(segment) {
        const startAngle = segment.startAngle + this.rotation;
        const endAngle = segment.endAngle + this.rotation;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.arc(this.centerX, this.centerY, this.radius, startAngle, endAngle);
        this.ctx.closePath();
        this.ctx.fillStyle = segment.color;
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#1A202C';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    drawPointer() {
        const pointerLength = 25;
        const pointerWidth = 15;
        
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, -this.radius - 10);
        this.ctx.lineTo(-pointerWidth/2, -this.radius - 10 - pointerLength);
        this.ctx.lineTo(pointerWidth/2, -this.radius - 10 - pointerLength);
        this.ctx.closePath();
        
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawLabels() {
        this.segments.forEach(segment => {
            const midAngle = (segment.startAngle + segment.endAngle) / 2 + this.rotation;
            const labelRadius = this.radius * 0.7;
            
            const x = this.centerX + Math.cos(midAngle) * labelRadius;
            const y = this.centerY + Math.sin(midAngle) * labelRadius;
            
            // Calculate segment size to determine if content fits
            const segmentAngle = segment.endAngle - segment.startAngle;
            const arcLength = segmentAngle * this.radius;
            const minArcLengthForContent = 80;
            
            if (arcLength >= minArcLengthForContent) {
                // Draw player avatar
                if (segment.player.avatar) {
                    this.drawPlayerAvatar(segment.player.avatar, x, y - 10, 40);
                }
                
                // Draw percentage
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                this.ctx.shadowColor = '#000000';
                this.ctx.shadowBlur = 3;
                this.ctx.shadowOffsetX = 1;
                this.ctx.shadowOffsetY = 1;
                
                this.ctx.fillText(`${segment.percentage.toFixed(1)}%`, x, y + 25);
                
                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }
        });
    }
    
    drawPlayerAvatar(avatarSrc, x, y, size) {
        if (this.avatarCache.has(avatarSrc)) {
            const img = this.avatarCache.get(avatarSrc);
            if (img.complete) {
                this.ctx.save();
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
                this.ctx.clip();
                
                this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
                this.ctx.restore();
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.avatarCache.set(avatarSrc, img);
                this.draw();
            };
            img.onerror = () => {
                this.drawFallbackAvatar(x, y, size);
            };
            img.src = avatarSrc;
            
            this.drawFallbackAvatar(x, y, size);
        }
    }
    
    drawFallbackAvatar(x, y, size) {
        this.ctx.save();
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#4ECCA3';
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `bold ${size * 0.4}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('?', x, y);
        
        this.ctx.restore();
    }
    
    drawEmptyWheel() {
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#2D3748';
        this.ctx.fill();
        this.ctx.strokeStyle = '#4A5568';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#A0AEC0';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Waiting for players...', this.centerX, this.centerY);
    }
    
    // NEW FOOLPROOF RIGGING METHOD
    spin() {
        if (this.isSpinning || this.segments.length === 0) {
            console.log('🚫 Cannot spin - already spinning or no segments');
            return;
        }
        
        this.isSpinning = true;
        this.startingRotation = this.rotation;
        
        // Set velocity (visual effect only)
        this.velocity = this.serverVelocity || (0.8 + Math.random() * 1.2);
        
        console.log('🎰 Starting spin with velocity:', this.velocity);
        console.log('🎯 Predetermined winner:', this.predeterminedWinner?.name || 'None');
        
        this.animate();
    }
    
    animate() {
        if (!this.isSpinning) return;
        
        this.rotation += this.velocity;
        this.velocity *= this.friction;
        
        if (this.velocity <= this.minVelocity) {
            this.velocity = 0;
            this.isSpinning = false;
            
            console.log('🛑 Spinner stopped naturally at rotation:', (this.rotation * 180 / Math.PI).toFixed(2) + '°');
            
            // Redraw final position
            this.draw();
            
            // Determine winner with rigging
            setTimeout(() => {
                this.determineWinnerWithRigging();
            }, 100);
            
            return;
        }
        
        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    // GUARANTEED RIGGING METHOD
    determineWinnerWithRigging() {
        console.log('🎯 Determining winner with rigging system...');
        
        // STEP 1: Check if we have a predetermined winner (real player)
        if (this.predeterminedWinner) {
            console.log('🎰 RIGGING ACTIVATED: Forcing predetermined winner:', this.predeterminedWinner.name);
            this.winner = this.predeterminedWinner;
            this.startWinnerAnimation();
            return this.winner;
        }
        
        // STEP 2: If no predetermined winner, check for real players and force them to win
        const realPlayers = this.players.filter(p => !p.isBot);
        if (realPlayers.length > 0) {
            console.log('🎯 RIGGING: Real players found, forcing first real player to win');
            this.winner = realPlayers[0];
            this.startWinnerAnimation();
            return this.winner;
        }
        
        // STEP 3: Fallback to normal winner determination (bots only)
        console.log('🎲 No real players - using normal winner determination');
        return this.determineWinnerNormally();
    }
    
    determineWinnerNormally() {
        if (this.segments.length === 0) {
            console.log('🎰 No segments found');
            return null;
        }
        
        const pointerAngle = (3 * Math.PI / 2); // Top pointer position
        
        for (let segment of this.segments) {
            let segmentStart = (segment.startAngle + this.rotation) % (2 * Math.PI);
            let segmentEnd = (segment.endAngle + this.rotation) % (2 * Math.PI);
            
            let pointerInSegment = false;
            if (segmentStart <= segmentEnd) {
                pointerInSegment = pointerAngle >= segmentStart && pointerAngle <= segmentEnd;
            } else {
                pointerInSegment = pointerAngle >= segmentStart || pointerAngle <= segmentEnd;
            }
            
            if (pointerInSegment) {
                this.winner = segment.player;
                console.log('🏆 Normal winner determined:', this.winner.name);
                this.startWinnerAnimation();
                return this.winner;
            }
        }
        
        console.log('⚠️ No winner found, selecting first player as fallback');
        this.winner = this.segments[0].player;
        this.startWinnerAnimation();
        return this.winner;
    }
    
    startWinnerAnimation() {
        if (!this.winner) return;
        
        const winningSegment = this.segments.find(segment => 
            segment.player.id === this.winner.id
        );
        
        if (winningSegment) {
            this.winnerAnimation = {
                active: true,
                progress: 0,
                duration: 3000,
                startTime: Date.now(),
                winnerColor: winningSegment.color,
                winnerData: {
                    name: this.winner.name,
                    betAmount: this.winner.betAmount,
                    percentage: winningSegment.percentage,
                    isBot: this.winner.isBot
                }
            };
            
            this.animateWinner();
        }
    }
    
    animateWinner() {
        if (!this.winnerAnimation.active) return;
        
        const elapsed = Date.now() - this.winnerAnimation.startTime;
        this.winnerAnimation.progress = Math.min(elapsed / this.winnerAnimation.duration, 1);
        
        this.draw();
        
        if (this.winnerAnimation.progress < 1) {
            requestAnimationFrame(() => this.animateWinner());
        } else {
            this.winnerAnimation.active = false;
        }
    }
    
    drawWinnerAnimation() {
        if (!this.winnerAnimation.active) return;
        
        const progress = this.winnerAnimation.progress;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        if (progress <= 0.6) {
            const expandRadius = this.radius * easeOut;
            
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, expandRadius, 0, 2 * Math.PI);
            this.ctx.fillStyle = this.winnerAnimation.winnerColor;
            this.ctx.fill();
            
            const pulseAlpha = 0.3 + 0.3 * Math.sin(progress * Math.PI * 8);
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, expandRadius, 0, 2 * Math.PI);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
            this.ctx.fill();
        }
        
        if (progress >= 0.4) {
            const textProgress = (progress - 0.4) / 0.6;
            const textAlpha = Math.min(textProgress * 2, 1);
            
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, 120, 0, 2 * Math.PI);
            this.ctx.fillStyle = `rgba(26, 32, 44, ${textAlpha * 0.9})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${textAlpha})`;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillText('🏆 WINNER! 🏆', this.centerX, this.centerY - 40);
            
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = `rgba(78, 204, 163, ${textAlpha})`;
            this.ctx.fillText(this.winnerAnimation.winnerData.name, this.centerX, this.centerY - 10);
            
            this.ctx.font = '16px Arial';
            this.ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
            this.ctx.fillText(`Bet: $${this.winnerAnimation.winnerData.betAmount.toFixed(2)}`, this.centerX, this.centerY + 15);
            
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`${this.winnerAnimation.winnerData.percentage.toFixed(1)}% chance`, this.centerX, this.centerY + 35);
        }
    }
    
    reset() {
        this.rotation = 0;
        this.velocity = 0;
        this.isSpinning = false;
        this.winner = null;
        this.predeterminedWinner = null;
        this.winnerAnimation.active = false;
        this.winnerAnimation.progress = 0;
        this.forceWinner = null;
        this.serverVelocity = null;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.draw();
    }
}
