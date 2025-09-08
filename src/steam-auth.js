import crypto from 'crypto';
import { URL, URLSearchParams } from 'url';

class SteamAuth {
    constructor() {
        this.steamOpenIdUrl = 'https://steamcommunity.com/openid/login';
        this.steamApiUrl = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/';
        this.realm = 'http://localhost:4200'; // Change this to your domain in production
        this.returnUrl = 'http://localhost:4200/auth/steam/return';
        
        // Store active sessions
        this.sessions = new Map();
    }

    // Generate Steam login URL
    getLoginUrl() {
        const params = new URLSearchParams({
            'openid.ns': 'http://specs.openid.net/auth/2.0',
            'openid.mode': 'checkid_setup',
            'openid.return_to': this.returnUrl,
            'openid.realm': this.realm,
            'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
        });

        return `${this.steamOpenIdUrl}?${params.toString()}`;
    }

    // Verify Steam OpenID response
    async verifyAssertion(query) {
        try {
            // Prepare verification parameters
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(query)) {
                params.append(key, value);
            }
            params.set('openid.mode', 'check_authentication');

            // Make verification request to Steam
            const response = await fetch(this.steamOpenIdUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            const result = await response.text();
            
            if (result.includes('is_valid:true')) {
                // Extract Steam ID from the identity URL
                const identity = query['openid.identity'];
                const steamId = identity.split('/').pop();
                return steamId;
            }
            
            return null;
        } catch (error) {
            console.error('Steam verification error:', error);
            return null;
        }
    }

    // Get Steam user profile (requires Steam API key)
    async getUserProfile(steamId, apiKey) {
        if (!apiKey) {
            // Return basic info without API key
            return {
                steamid: steamId,
                personaname: `Player_${steamId.slice(-6)}`,
                avatar: '/static/imgs/default-avatar.png',
                profileurl: `https://steamcommunity.com/profiles/${steamId}`
            };
        }

        try {
            const url = `${this.steamApiUrl}?key=${apiKey}&steamids=${steamId}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.response && data.response.players && data.response.players.length > 0) {
                return data.response.players[0];
            }
            
            return null;
        } catch (error) {
            console.error('Steam API error:', error);
            return null;
        }
    }

    // Create user session
    createSession(steamId, userProfile) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const session = {
            id: sessionId,
            steamId: steamId,
            profile: userProfile,
            createdAt: Date.now(),
            lastActive: Date.now()
        };
        
        this.sessions.set(sessionId, session);
        return sessionId;
    }

    // Get session by ID
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActive = Date.now();
            return session;
        }
        return null;
    }

    // Remove session
    destroySession(sessionId) {
        return this.sessions.delete(sessionId);
    }

    // Clean up expired sessions (older than 24 hours)
    cleanupSessions() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActive > maxAge) {
                this.sessions.delete(sessionId);
            }
        }
    }
}

export default SteamAuth;
