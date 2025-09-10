// Jackpot Spinner - Physics-based spinning wheel
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
        this.forceWinner = null;
        this.predeterminedWinner = null; // For rigging
        this.serverVelocity = null;
        
        // Pointer settings
        this.pointerAngle = 0;
        
        // Handle page refresh/unload while spinning
        window.addEventListener('beforeunload', () => {
            this.handlePageUnload();
        });
        
        this.setupCanvas();
        this.draw();
    }
    
    setupCanvas() {
        this.canvas.width = 400;
        this.canvas.height = 400;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = 180;
    }
    
    updatePlayers(players) {
        this.players = players;
        this.createSegments();
        if (!this.isSpinning) {
            this.draw();
        }
    }
    
    createSegments() {
        this.segments = [];
        
        if (this.players.length === 0) {
            return;
        }
        
        const totalPot = this.players.reduce((sum, player) => sum + player.betAmount, 0);
        let currentAngle = 0;
        
        this.players.forEach((player, index) => {
            const percentage = player.betAmount / totalPot;
            const segmentAngle = percentage * 2 * Math.PI;
            
            this.segments.push({
                player: player,
                startAngle: currentAngle,
                endAngle: currentAngle + segmentAngle,
                color: this.colors[index % this.colors.length],
                percentage: percentage * 100
            });
            
            currentAngle += segmentAngle;
        });
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw outer ring
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius + 10, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#2D3748';
        this.ctx.fill();
        
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
        
        // Draw degree markings
        this.drawDegreeMarkings();
        
        // Draw pointer (above degree markings)
        this.drawPointer();
        
        // Draw winner animation if active (above everything else)
        if (this.winnerAnimation && this.winnerAnimation.active) {
            this.drawWinnerAnimation();
        }
        
        // Draw player labels if segments exist and no winner animation active
        if (this.segments.length > 0 && !this.winnerAnimation.active) {
            this.drawLabels();
        }
    }
    
    drawSegment(segment) {
        const startAngle = segment.startAngle + this.rotation;
        const endAngle = segment.endAngle + this.rotation;
        
        // Draw segment
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.arc(this.centerX, this.centerY, this.radius, startAngle, endAngle);
        this.ctx.closePath();
        this.ctx.fillStyle = segment.color;
        this.ctx.fill();
        
        // Draw segment border
        this.ctx.strokeStyle = '#1A202C';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    drawDegreeMarkings() {
        const markingRadius = this.radius + 15;
        const textRadius = this.radius + 35;
        
        // Draw major degree markings every 30 degrees
        for (let i = 0; i < 360; i += 30) {
            const angle = (i * Math.PI) / 180;
            
            // Calculate positions for major markings
            const innerX = this.centerX + Math.cos(angle - Math.PI/2) * (this.radius + 2);
            const innerY = this.centerY + Math.sin(angle - Math.PI/2) * (this.radius + 2);
            const outerX = this.centerX + Math.cos(angle - Math.PI/2) * markingRadius;
            const outerY = this.centerY + Math.sin(angle - Math.PI/2) * markingRadius;
            
            // Draw major marking line
            this.ctx.beginPath();
            this.ctx.moveTo(innerX, innerY);
            this.ctx.lineTo(outerX, outerY);
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Draw degree text with background
            const textX = this.centerX + Math.cos(angle - Math.PI/2) * textRadius;
            const textY = this.centerY + Math.sin(angle - Math.PI/2) * textRadius;
            
            // Draw text background circle
            this.ctx.beginPath();
            this.ctx.arc(textX, textY, 12, 0, 2 * Math.PI);
            this.ctx.fillStyle = '#1A202C';
            this.ctx.fill();
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            // Draw degree text
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(i + '°', textX, textY);
        }
    }
    
    drawPointer() {
        // Red pointer at top (270 degrees)
        const pointerLength = 25;
        const pointerWidth = 15;
        const pointerAngle = 3 * Math.PI / 2; // 270 degrees - top of circle
        
        // Calculate pointer tip position (on the wheel edge)
        const tipX = this.centerX + Math.cos(pointerAngle) * this.radius;
        const tipY = this.centerY + Math.sin(pointerAngle) * this.radius;
        
        // Calculate base positions
        const baseDistance = this.radius + pointerLength;
        const baseX = this.centerX + Math.cos(pointerAngle) * baseDistance;
        const baseY = this.centerY + Math.sin(pointerAngle) * baseDistance;
        
        // Calculate side points for triangle
        const sideAngle1 = pointerAngle + Math.PI / 2;
        const sideAngle2 = pointerAngle - Math.PI / 2;
        const side1X = baseX + Math.cos(sideAngle1) * (pointerWidth / 2);
        const side1Y = baseY + Math.sin(sideAngle1) * (pointerWidth / 2);
        const side2X = baseX + Math.cos(sideAngle2) * (pointerWidth / 2);
        const side2Y = baseY + Math.sin(sideAngle2) * (pointerWidth / 2);
        
        // Draw pointer triangle
        this.ctx.beginPath();
        this.ctx.moveTo(tipX, tipY);
        this.ctx.lineTo(side1X, side1Y);
        this.ctx.lineTo(side2X, side2Y);
        this.ctx.closePath();
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Add shadow for depth
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }
    
    drawLabels() {
        this.segments.forEach(segment => {
            const midAngle = (segment.startAngle + segment.endAngle) / 2 + this.rotation;
            const labelRadius = this.radius * 0.7;
            
            const x = this.centerX + Math.cos(midAngle) * labelRadius;
            const y = this.centerY + Math.sin(midAngle) * labelRadius;
            
            // Calculate segment arc length to determine if content fits
            const segmentAngle = segment.endAngle - segment.startAngle;
            const arcLength = segmentAngle * this.radius;
            
            // Minimum arc length needed for avatar (40px) + percentage text (approx 30px) + padding
            const minArcLengthForContent = 80;
            
            // Only draw content if segment is large enough
            if (arcLength >= minArcLengthForContent) {
                // Draw player avatar
                if (segment.player.avatar) {
                    this.drawPlayerAvatar(segment.player.avatar, x, y - 10, 40);
                }
                
                // Draw percentage below avatar with more spacing
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                // Add shadow for better readability
                this.ctx.shadowColor = '#000000';
                this.ctx.shadowBlur = 3;
                this.ctx.shadowOffsetX = 1;
                this.ctx.shadowOffsetY = 1;
                
                this.ctx.fillText(`${segment.percentage.toFixed(1)}%`, x, y + 25);
                
                // Reset shadow
                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }
        });
    }
    
    drawPlayerAvatar(avatarSrc, x, y, size) {
        // Check if we already have this image cached
        if (!this.avatarCache) {
            this.avatarCache = new Map();
        }
        
        if (this.avatarCache.has(avatarSrc)) {
            const img = this.avatarCache.get(avatarSrc);
            if (img.complete) {
                this.ctx.save();
                
                // Create circular clipping path
                this.ctx.beginPath();
                this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
                this.ctx.clip();
                
                // Draw the image
                this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
                
                this.ctx.restore();
                
                // Draw border around avatar
                this.ctx.beginPath();
                this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        } else {
            // Load and cache the image
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.avatarCache.set(avatarSrc, img);
                this.draw();
            };
            img.onerror = () => {
                console.warn('Failed to load avatar:', avatarSrc);
            };
            img.src = avatarSrc;
        }
    }
    
    spin(forceWinner = null, serverVelocity = null, predeterminedWinner = null) {
        if (this.isSpinning) {
            console.log('⚠️ Spinner is already spinning!');
            return;
        }
        
        if (this.segments.length === 0) {
            console.log('⚠️ No segments to spin!');
            return;
        }
        
        console.log('🎰 Starting spinner with segments:', this.segments.map(s => ({
            player: s.player.name,
            percentage: s.percentage.toFixed(2) + '%',
            startAngle: (s.startAngle * 180 / Math.PI).toFixed(2) + '°',
            endAngle: (s.endAngle * 180 / Math.PI).toFixed(2) + '°'
        })));
        
        // Store rigging parameters
        this.forceWinner = forceWinner;
        this.predeterminedWinner = predeterminedWinner;
        this.serverVelocity = serverVelocity;
        
        // Set velocity - prioritize server velocity if provided
        if (this.serverVelocity) {
            this.velocity = this.serverVelocity;
            console.log('🎯 Using server-calculated velocity:', this.velocity);
        } else if (this.forceWinner) {
            // Calculate velocity to land on forced winner
            this.velocity = this.calculateVelocityForWinner(this.forceWinner);
            console.log('🎯 Calculated velocity for forced winner:', this.velocity);
        } else {
            // Random velocity for normal spin
            this.velocity = 0.8 + Math.random() * 1.2;
            console.log('🎲 Using random velocity:', this.velocity);
        }
        
        // Ensure we have a valid velocity
        if (this.velocity <= 0) {
            console.error('❌ Invalid velocity, setting to default');
            this.velocity = 1.0;
        }
        
        // Start spinning
        this.isSpinning = true;
        this.winner = null;
        this.winnerAnimation.active = false;
        
        console.log('🚀 Spinner started with velocity:', this.velocity);
        this.update();
    }
    
    update() {
        if (!this.isSpinning) return;
        
        // Apply friction
        this.velocity *= this.friction;
        
        // Update rotation
        this.rotation += this.velocity;
        
        // Check if spinner should stop
        if (this.velocity <= this.minVelocity) {
            this.velocity = 0;
            this.isSpinning = false;
            
            // RIGGING: Override final rotation to land on predetermined winner
            if (this.predeterminedWinner) {
                console.log('🎯 RIGGING: Overriding final rotation for predetermined winner:', this.predeterminedWinner.name);
                
                // Find the predetermined winner's segment
                const winnerSegment = this.segments.find(segment => 
                    segment.player.id === this.predeterminedWinner.id
                );
                
                if (winnerSegment) {
                    // Calculate the middle of the winner's segment
                    const segmentMid = (winnerSegment.startAngle + winnerSegment.endAngle) / 2;
                    
                    // Pointer is at 270 degrees (3π/2)
                    const pointerAngle = 3 * Math.PI / 2;
                    
                    // Calculate rotation needed to align segment middle with pointer
                    let targetRotation = pointerAngle - segmentMid;
                    
                    // Normalize to positive rotation and preserve visual spinning effect
                    const currentFullRotations = Math.floor(this.rotation / (2 * Math.PI));
                    while (targetRotation < 0) {
                        targetRotation += 2 * Math.PI;
                    }
                    targetRotation += currentFullRotations * 2 * Math.PI;
                    
                    // Override the rotation
                    this.rotation = targetRotation;
                    
                    console.log('🎰 RIGGED: Final rotation set to:', (this.rotation * 180 / Math.PI).toFixed(2) + '°');
                    console.log('🎯 Target segment middle:', (segmentMid * 180 / Math.PI).toFixed(2) + '°');
                }
            }
            
            console.log('🛑 Spinner stopped at rotation:', (this.rotation * 180 / Math.PI).toFixed(2) + '°');
            
            // Determine winner after spinner stops
            const winner = this.determineWinner();
            if (winner && this.onSpinComplete) {
                this.onSpinComplete(winner);
            }
        }
        
        // Redraw and continue animation
        this.draw();
        if (this.isSpinning) {
            this.animationId = requestAnimationFrame(() => this.update());
        }
    }
    
    determineWinner() {
        if (this.isSpinning || this.velocity > 0) {
            console.log('⚠️ WARNING: Attempted to determine winner while spinner still moving!');
            return null;
        }
        
        if (this.segments.length === 0) {
            console.log('🎰 Spinner stopped but no segments found');
            return null;
        }
        
        console.log('✅ CONFIRMED: Spinner is at complete stop, determining winner...');
        
        // Always determine winner by where the red pointer lands
        const pointerAngle = (3 * Math.PI / 2); // 270 degrees - top of circle (red pointer position)
        
        console.log('🎯 Determining winner by pointer position at:', (pointerAngle * 180 / Math.PI).toFixed(2) + '°');
        
        // Find the segment that contains the pointer position
        for (let segment of this.segments) {
            // Adjust segment angles by current rotation
            let segmentStart = (segment.startAngle + this.rotation) % (2 * Math.PI);
            let segmentEnd = (segment.endAngle + this.rotation) % (2 * Math.PI);
            
            // Handle wraparound case
            let pointerInSegment = false;
            if (segmentStart <= segmentEnd) {
                pointerInSegment = pointerAngle >= segmentStart && pointerAngle <= segmentEnd;
            } else {
                pointerInSegment = pointerAngle >= segmentStart || pointerAngle <= segmentEnd;
            }
            
            if (pointerInSegment) {
                this.winner = segment.player;
                console.log('🏆 WINNER DETERMINED:', {
                    name: this.winner.name,
                    betAmount: this.winner.betAmount,
                    percentage: segment.percentage.toFixed(2) + '%',
                    segmentStart: (segmentStart * 180 / Math.PI).toFixed(2) + '°',
                    segmentEnd: (segmentEnd * 180 / Math.PI).toFixed(2) + '°',
                    pointerAt: (pointerAngle * 180 / Math.PI).toFixed(2) + '°'
                });
                
                this.startWinnerAnimation();
                return this.winner;
            }
        }
        
        console.error('❌ No winner found - this should not happen!');
        return null;
    }
    
    calculateVelocityForWinner(playerSegment) {
        if (!playerSegment) return 1.0;
        
        // Calculate the middle of the target segment
        const segmentMid = (playerSegment.startAngle + playerSegment.endAngle) / 2;
        
        // Pointer is at 270 degrees (3π/2)
        const pointerAngle = 3 * Math.PI / 2;
        
        // Calculate required rotation to land pointer on segment middle
        let targetRotation = pointerAngle - segmentMid;
        
        // Normalize to positive rotation
        while (targetRotation < 0) {
            targetRotation += 2 * Math.PI;
        }
        
        // Add 4-6 full rotations for dramatic effect
        const extraRotations = 4 + Math.random() * 2;
        targetRotation += extraRotations * 2 * Math.PI;
        
        // Use binary search for precise velocity calculation
        let minVel = 0.3;
        let maxVel = 2.5;
        let bestVelocity = 1.0;
        let bestDifference = Infinity;
        
        for (let iteration = 0; iteration < 50; iteration++) {
            const testVel = (minVel + maxVel) / 2;
            const simulatedRotation = this.simulateRotation(testVel);
            const difference = Math.abs(simulatedRotation - targetRotation);
            
            if (difference < bestDifference) {
                bestDifference = difference;
                bestVelocity = testVel;
            }
            
            if (simulatedRotation < targetRotation) {
                minVel = testVel;
            } else {
                maxVel = testVel;
            }
            
            if (difference < 0.001) break;
        }
        
        return bestVelocity;
    }
    
    simulateRotation(initialVelocity) {
        let velocity = initialVelocity;
        let totalRotation = 0;
        
        while (velocity > this.minVelocity) {
            totalRotation += velocity;
            velocity *= this.friction;
        }
        
        return totalRotation;
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
        
        // Phase 1: Color takeover (0-0.6)
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
        
        // Phase 2: Winner text display (0.4-1.0)
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
    
    handlePageUnload() {
        if (this.isSpinning) {
            console.log('🔄 Page unloading while spinner is active - cleaning up');
            
            this.isSpinning = false;
            this.velocity = 0;
            
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
    }
}
