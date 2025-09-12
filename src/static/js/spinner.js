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
        this.friction = 0.995; // Reduced friction for longer spins
        this.isSpinning = false;
        this.minVelocity = 0.0005; // Even lower threshold for complete stop
        this.startingRotation = 0; // Track starting position
        
        // Animation
        this.animationId = null;
        this.winner = null;
        this.winnerAnimation = {
            active: false,
            progress: 0,
            duration: 2000, // 2 seconds
            startTime: 0,
            winnerColor: null,
            winnerData: null
        };
        this.forceWinner = null; // Force specific winner
        
        // Pointer settings
        this.pointerAngle = 0; // Pointer at top (12 o'clock)
        
        // Handle page refresh/unload while spinning
        window.addEventListener('beforeunload', () => {
            this.handlePageUnload();
        });
        
        this.setupCanvas();
        this.draw();
    }
    
    setupCanvas() {
        // Set canvas size
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
        const markingRadius = this.radius + 15; // Extended further out
        const textRadius = this.radius + 35; // Text positioned further out
        
        // Draw major degree markings every 30 degrees
        for (let i = 0; i < 360; i += 30) {
            const angle = (i * Math.PI) / 180;
            
            // Calculate positions for major markings - extend from wheel edge outward
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
            
            // Draw degree text with background for better visibility
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
        
        // Draw minor degree markings every 10 degrees (excluding major ones)
        for (let i = 0; i < 360; i += 10) {
            if (i % 30 !== 0) { // Skip major markings
                const angle = (i * Math.PI) / 180;
                
                // Calculate positions for minor markings
                const innerX = this.centerX + Math.cos(angle - Math.PI/2) * (this.radius + 2);
                const innerY = this.centerY + Math.sin(angle - Math.PI/2) * (this.radius + 2);
                const outerX = this.centerX + Math.cos(angle - Math.PI/2) * (markingRadius - 5);
                const outerY = this.centerY + Math.sin(angle - Math.PI/2) * (markingRadius - 5);
                
                // Draw minor marking line
                this.ctx.beginPath();
                this.ctx.moveTo(innerX, innerY);
                this.ctx.lineTo(outerX, outerY);
                this.ctx.strokeStyle = '#B0B0B0';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
    }
    
    drawPointer() {
        const pointerSize = 20;
        
        // Draw pointer triangle (now drawn above degree markings)
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.radius - 15);
        this.ctx.lineTo(this.centerX - pointerSize, this.centerY - this.radius - 45); // Extended further out
        this.ctx.lineTo(this.centerX + pointerSize, this.centerY - this.radius - 45);
        this.ctx.closePath();
        this.ctx.fillStyle = '#E53E3E';
        this.ctx.fill();
        this.ctx.strokeStyle = '#C53030';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // Add shadow for better visibility
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        // Redraw to apply shadow
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.radius - 15);
        this.ctx.lineTo(this.centerX - pointerSize, this.centerY - this.radius - 45);
        this.ctx.lineTo(this.centerX + pointerSize, this.centerY - this.radius - 45);
        this.ctx.closePath();
        this.ctx.fillStyle = '#E53E3E';
        this.ctx.fill();
        
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
            
            // Minimum space needed: 50px for avatar + text
            const minSpaceNeeded = 50;
            const shouldShowContent = arcLength >= minSpaceNeeded;
            
            if (shouldShowContent) {
                // Draw player avatar
                if (segment.player.avatar) {
                    this.drawPlayerAvatar(segment.player.avatar, x, y - 10, 40); // 40px avatar size, moved up
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
                
                this.ctx.fillText(`${segment.percentage.toFixed(1)}%`, x, y + 25); // Moved further down
                
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
                // Redraw to show the loaded avatar
                this.draw();
            };
            img.onerror = () => {
                // Fallback to initials if image fails to load
                this.drawAvatarFallback(x, y, size, avatarSrc);
            };
            img.src = avatarSrc;
            
            // Draw placeholder while loading
            this.drawAvatarFallback(x, y, size, avatarSrc);
        }
    }
    
    drawAvatarFallback(x, y, size, avatarSrc) {
        // Draw a circle with initials as fallback
        this.ctx.save();
        
        // Draw background circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#4ECCA3';
        this.ctx.fill();
        
        // Draw border
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw "?" as fallback text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `bold ${size * 0.4}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('?', x, y);
        
        this.ctx.restore();
    }
    
    rigSpinnerToWinner(targetPlayer) {
        console.log('🎯 ABSOLUTE RIGGING: Setting up guaranteed win for:', targetPlayer.name);
        
        // Find the target player's segment
        const targetSegment = this.segments.find(segment => 
            segment.player.id === targetPlayer.id || segment.player.name === targetPlayer.name
        );
        
        if (!targetSegment) {
            console.error('❌ Target segment not found for player:', targetPlayer.name);
            // Fallback to normal spin
            this.velocity = Math.random() * 0.3 + 0.1;
            this.animate();
            return;
        }
        
        // Calculate the middle of the target segment
        const segmentMid = (targetSegment.startAngle + targetSegment.endAngle) / 2;
        const pointerAngle = 3 * Math.PI / 2; // top pointer (270 degrees)

        // Determine final rotation. Prefer serverTargetRotation if provided.
        let finalRotation;
        if (this.serverTargetRotation && typeof this.serverTargetRotation === 'number') {
            finalRotation = this.serverTargetRotation;
            console.log('🛰️ Using serverTargetRotation (deg):', (finalRotation * 180 / Math.PI).toFixed(2));
        } else {
            // Client-side deterministic calculation
            // We need to rotate the wheel so that the segment center aligns with the pointer
            // The pointer is at 270° (3π/2), so we need: segmentMid + finalRotation = pointerAngle (mod 2π)
            let targetRotation = pointerAngle - segmentMid;
            
            // Normalize to positive angle
            while (targetRotation < 0) targetRotation += 2 * Math.PI;
            
            // Add multiple full rotations for dramatic effect (4-6 spins)
            const extraSpins = 4 + Math.random() * 2;
            targetRotation += extraSpins * 2 * Math.PI;
            
            finalRotation = targetRotation;
            console.log('🧮 Client-computed targetRotation (deg):', (finalRotation * 180 / Math.PI).toFixed(2));
            console.log('🎯 Segment mid angle (deg):', (segmentMid * 180 / Math.PI).toFixed(2));
            console.log('🎯 Expected final position (deg):', ((segmentMid + finalRotation) * 180 / Math.PI % 360).toFixed(2));
        }

        // Prepare rigged animation to final rotation
        this.riggedStartRotation = this.rotation;
        this.riggedFinalRotation = finalRotation;
        this.riggedAnimationFrames = 180; // 3s @60fps
        this.riggedCurrentFrame = 0;
        
        // Start rigged animation
        this.animateRigged();
    }
    
    animateRigged() {
        this.riggedCurrentFrame++;
        
        // Use easing function for smooth deceleration
        const progress = this.riggedCurrentFrame / this.riggedAnimationFrames;
        const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
        
        // Update rotation with easing to final rotation
        this.rotation = this.riggedStartRotation + easedProgress * (this.riggedFinalRotation - this.riggedStartRotation);
        
        // Redraw spinner
        this.draw();
        
        if (this.riggedCurrentFrame < this.riggedAnimationFrames) {
            // Continue animation
            requestAnimationFrame(() => this.animateRigged());
        } else {
            // Animation complete - spinner has landed exactly on target
            console.log('🎯 RIGGED ANIMATION COMPLETE - Final rotation:', (this.rotation * 180 / Math.PI).toFixed(2) + '°');
            this.isSpinning = false;
            this.velocity = 0;
            
            // Force the predetermined winner
            this.winner = this.predeterminedWinner;
            this.startWinnerAnimation();
        }
    }
    
    spin() {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        this.winner = null;
        
        // Reset winner animation
        this.winnerAnimation = { active: false };
        
        console.log('🎰 Starting spinner with segments:', this.segments.length);
        
        if (this.predeterminedWinner) {
            // ABSOLUTE RIGGING: Calculate exact rotation to land on real player
            console.log('🎯 ABSOLUTE RIGGING: Forcing spinner to land on:', this.predeterminedWinner.name);
            this.rigSpinnerToWinner(this.predeterminedWinner);
            return;
        } else if (this.forceWinner) {
            if (this.serverVelocity) {
                // Use server-calculated velocity for precise landing
                console.log('🎯 Using server-calculated velocity:', this.serverVelocity);
                this.velocity = this.serverVelocity;
            } else {
                // Client-side calculation for forced winner
                console.log('🎯 Calculating velocity to land on forced winner:', this.forceWinner.name);
                this.velocity = this.calculateVelocityForWinner(this.forceWinner);
            }
        } else {
            // Random velocity for natural spin
            this.velocity = Math.random() * 0.3 + 0.1;
        }
        
        console.log('🎰 Initial velocity:', this.velocity);
        this.animate();
    }
    
    animate() {
        console.log('🔄 Animate frame - velocity:', this.velocity.toFixed(6), 'rotation:', (this.rotation * 180 / Math.PI).toFixed(2) + '°');
        
        // Apply friction
        this.velocity *= this.friction;
        
        // Update rotation
        this.rotation += this.velocity;
        
        // Keep rotation within 0-2π
        this.rotation = this.rotation % (2 * Math.PI);
        
        // Draw current frame
        this.draw();
        
        // Continue animation if still spinning
        if (this.velocity > this.minVelocity) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            // Spinner has completely stopped - ensure absolute zero velocity
            this.velocity = 0;
            this.isSpinning = false;
            
            // Draw final frame to show complete stop
            this.draw();
            
            console.log('🛑 Spinner has come to a COMPLETE STOP');
            console.log('📍 Final velocity: 0');
            console.log('📍 Final rotation:', (this.rotation * 180 / Math.PI).toFixed(2) + '°');
            
            // Wait additional time to ensure visual confirmation of stop
            setTimeout(() => {
                console.log('⚡ Now determining winner after complete stop...');
                this.determineWinner();
            }, 500);
        }
    }
    
    determineWinner() {
        // Verify spinner is completely stopped before proceeding
        if (this.isSpinning || this.velocity > 0) {
            console.log('⚠️ WARNING: Attempted to determine winner while spinner still moving!');
            console.log('📊 Current velocity:', this.velocity);
            console.log('📊 Is spinning:', this.isSpinning);
            return null;
        }
        
        if (this.segments.length === 0) {
            console.log('🎰 Spinner stopped but no segments found');
            return null;
        }
        
        console.log('✅ CONFIRMED: Spinner is at complete stop, determining winner...');
        
        // If we have a predetermined winner (real player), FORCE them to win
        if (this.predeterminedWinner) {
            console.log('🎯 FORCING predetermined winner:', this.predeterminedWinner.name);
            console.log('🔍 SPINNER DEBUG: predeterminedWinner object:', this.predeterminedWinner);
            this.winner = this.predeterminedWinner;
            this.startWinnerAnimation();
            return this.winner;
        } else {
            console.log('⚠️ SPINNER DEBUG: No predeterminedWinner set, using physics');
            console.log('🔍 SPINNER DEBUG: this.predeterminedWinner =', this.predeterminedWinner);
        }
        
        // Always determine winner by where the red pointer lands
        const pointerAngle = (3 * Math.PI / 2); // 270 degrees - top of circle (red pointer position)
        
        console.log('🎯 Determining winner by pointer position at:', (pointerAngle * 180 / Math.PI).toFixed(2) + '°');
        
        // Find the segment that contains the pointer position
        for (let segment of this.segments) {
            // Adjust segment angles by current rotation
            let segmentStart = (segment.startAngle + this.rotation) % (2 * Math.PI);
            let segmentEnd = (segment.endAngle + this.rotation) % (2 * Math.PI);
            
            // Normalize angles to [0, 2π]
            if (segmentStart < 0) segmentStart += 2 * Math.PI;
            if (segmentEnd < 0) segmentEnd += 2 * Math.PI;
            
            // Handle wraparound case
            let pointerInSegment = false;
            if (segmentStart <= segmentEnd) {
                // Normal case - no wraparound
                pointerInSegment = (pointerAngle >= segmentStart && pointerAngle <= segmentEnd);
            } else {
                // Wraparound case - segment crosses 0/360 boundary
                pointerInSegment = (pointerAngle >= segmentStart || pointerAngle <= segmentEnd);
            }
            
            if (pointerInSegment) {
                this.winner = segment.player;
                console.log('🏆 Winner determined by pointer landing:', {
                    player: this.winner.name,
                    isBot: this.winner.isBot,
                    segmentStart: (segmentStart * 180 / Math.PI).toFixed(2) + '°',
                    segmentEnd: (segmentEnd * 180 / Math.PI).toFixed(2) + '°',
                    pointerAngle: (pointerAngle * 180 / Math.PI).toFixed(2) + '°',
                    currentRotation: (this.rotation * 180 / Math.PI).toFixed(2) + '°'
                });
                break;
            }
        }
        
        // Handle edge case where pointer is exactly on a boundary
        if (!this.winner && this.segments.length > 0) {
            this.winner = this.segments[0].player;
            console.log('⚠️ Edge case: Winner defaulted to first segment:', this.winner.name);
        }
        
        // In realtime mode, send winner back to server and update local game
        if (window.socket && this.winner) {
            console.log('📡 Sending spinner result to server:', this.winner.name);
            
            // Update local game state immediately with spinner result
            if (window.jackpotGame) {
                window.jackpotGame.currentGame.winner = this.winner;
                console.log('🎯 Updated local game winner to match spinner:', this.winner.name);
            }
            
            window.socket.emit('spinner_result', { 
                winner: {
                    id: this.winner.id,
                    name: this.winner.name,
                    betAmount: this.winner.betAmount,
                    isBot: this.winner.isBot
                }
            });
        } else if (!window.socket && window.jackpotGame && this.winner) {
            // Local mode fallback
            window.jackpotGame.currentGame.winner = this.winner;
            window.jackpotGame.saveGameToHistory();
            
            // Show winner animation after a brief delay
            setTimeout(() => {
                window.jackpotGame.showWinnerAnimation();
            }, 1000);
            
            // Start new game after showing winner
            setTimeout(() => {
                window.jackpotGame.startNewGame();
            }, 6000);
        }
        
        // Start winner animation immediately after spinner stops
        this.startWinnerAnimation();
        
        // Notify server that spinner has stopped (after winner animation completes)
        setTimeout(() => {
            if (window.socket) {
                console.log('📡 Notifying server that spinner has stopped');
                window.socket.emit('spinner_stopped');
            }
        }, 3000); // Wait for winner animation to complete
        
        return this.winner;
    }
    
    calculateVelocityToLandOnPlayer(playerSegment) {
        // Calculate precise velocity to land on the predetermined winner
        const segmentMid = (playerSegment.startAngle + playerSegment.endAngle) / 2;
        const pointerAngle = 3 * Math.PI / 2; // 270 degrees - red pointer at top
        
        // Calculate how much we need to rotate to align segment center with pointer
        let targetRotation = pointerAngle - segmentMid;
        
        // Normalize to current rotation
        targetRotation = targetRotation - this.rotation;
        
        // Add 4-6 full rotations for dramatic spinning effect
        const extraRotations = 4 + Math.random() * 2;
        targetRotation += extraRotations * 2 * Math.PI;
        
        // Ensure positive rotation
        while (targetRotation < 0) {
            targetRotation += 2 * Math.PI;
        }
        
        // Use binary search for more precise velocity calculation
        let minVel = 0.3;
        let maxVel = 2.5;
        let bestVelocity = 1.0;
        let bestDifference = Infinity;
        
        // Binary search for optimal velocity
        for (let iteration = 0; iteration < 50; iteration++) {
            const testVel = (minVel + maxVel) / 2;
            const simulatedRotation = this.simulateRotation(testVel);
            const difference = Math.abs(simulatedRotation - targetRotation);
            
            if (difference < bestDifference) {
                bestDifference = difference;
                bestVelocity = testVel;
            }
            
            // Adjust search range
            if (simulatedRotation < targetRotation) {
                minVel = testVel;
            } else {
                maxVel = testVel;
            }
            
            // If we're close enough, break early
            if (difference < 0.001) break;
        }
        
        console.log('🎯 Calculated precise velocity for winner:', {
            playerName: playerSegment.player ? playerSegment.player.name : 'Unknown',
            segmentMid: (segmentMid * 180 / Math.PI).toFixed(2) + '°',
            targetRotation: (targetRotation * 180 / Math.PI).toFixed(2) + '°',
            velocity: bestVelocity.toFixed(4),
            expectedDifference: (bestDifference * 180 / Math.PI).toFixed(4) + '°'
        });
        
        return bestVelocity;
    }
    
    simulateRotation(initialVelocity) {
        // Simulate the physics to predict final rotation
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
        
        // Find the winning segment
        const winningSegment = this.segments.find(segment => 
            segment.player.id === this.winner.id
        );
        
        if (winningSegment) {
            this.winnerAnimation = {
                active: true,
                progress: 0,
                duration: 3000, // 3 seconds
                startTime: Date.now(),
                winnerColor: winningSegment.color,
                winnerData: {
                    name: this.winner.name,
                    betAmount: this.winner.betAmount,
                    percentage: winningSegment.percentage,
                    isBot: this.winner.isBot
                }
            };
            
            // Start animation loop
            this.animateWinner();
        }
    }
    
    animateWinner() {
        if (!this.winnerAnimation.active) return;
        
        const elapsed = Date.now() - this.winnerAnimation.startTime;
        this.winnerAnimation.progress = Math.min(elapsed / this.winnerAnimation.duration, 1);
        
        // Redraw with animation
        this.draw();
        
        if (this.winnerAnimation.progress < 1) {
            requestAnimationFrame(() => this.animateWinner());
        } else {
            // Animation complete
            this.winnerAnimation.active = false;
        }
    }
    
    drawWinnerAnimation() {
        if (!this.winnerAnimation.active) return;
        
        const progress = this.winnerAnimation.progress;
        const easeOut = 1 - Math.pow(1 - progress, 3); // Smooth easing
        
        // Phase 1: Color takeover (0-0.6)
        if (progress <= 0.6) {
            const takeoverProgress = progress / 0.6;
            const expandRadius = this.radius * easeOut;
            
            // Draw expanding winner color circle
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, expandRadius, 0, 2 * Math.PI);
            this.ctx.fillStyle = this.winnerAnimation.winnerColor;
            this.ctx.fill();
            
            // Add pulsing effect
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
            
            // Draw winner text background
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, 120, 0, 2 * Math.PI);
            this.ctx.fillStyle = `rgba(26, 32, 44, ${textAlpha * 0.9})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${textAlpha})`;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Draw winner text
            this.ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Winner title
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillText('🏆 WINNER! 🏆', this.centerX, this.centerY - 40);
            
            // Player name
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = `rgba(78, 204, 163, ${textAlpha})`;
            this.ctx.fillText(this.winnerAnimation.winnerData.name, this.centerX, this.centerY - 10);
            
            // Bet amount
            this.ctx.font = '16px Arial';
            this.ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
            this.ctx.fillText(`Bet: $${this.winnerAnimation.winnerData.betAmount.toFixed(2)}`, this.centerX, this.centerY + 15);
            
            // Win percentage
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
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.draw();
    }
    
    // Handle page unload while spinning
    handlePageUnload() {
        if (this.isSpinning) {
            console.log('🔄 Page unloading while spinner is active - cleaning up');
            
            // Stop animation immediately
            this.isSpinning = false;
            this.velocity = 0;
            
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
            
            // If we're in realtime mode, notify server that spinner was interrupted
            if (window.socket) {
                window.socket.emit('spinner_interrupted', {
                    reason: 'page_refresh',
                    currentRotation: this.rotation
                });
            }
        }
    }
    
    // Force reset spinner state (used when recovering from page refresh)
    forceReset() {
        console.log('🔧 Force resetting spinner state');
        
        // Cancel any running animations
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset all spinning state
        this.isSpinning = false;
        this.velocity = 0;
        this.winner = null;
        this.winnerAnimation.active = false;
        this.winnerAnimation.progress = 0;
        
        // Don't reset rotation or segments - keep visual state
        console.log('✅ Spinner state force reset complete');
    }
    
    // Get current winner without spinning (for testing)
    getCurrentWinner() {
        if (this.segments.length === 0) return null;
        
        let normalizedRotation = (2 * Math.PI - this.rotation) % (2 * Math.PI);
        
        for (let segment of this.segments) {
            if (normalizedRotation >= segment.startAngle && normalizedRotation <= segment.endAngle) {
                return segment.player;
            }
        }
        
        return this.segments[0].player;
    }
}
