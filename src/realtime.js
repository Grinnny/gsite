// Realtime jackpot server using Socket.IO (optional)
// This module safely enables realtime if 'socket.io' is installed.
// It keeps all state in memory to satisfy: no shared DB, local-only history.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';

export async function initRealtime(fastify) {
  let Server;
  try {
    // Dynamically import socket.io so the app still runs if it's not installed yet
    ({ Server } = await import('socket.io'));
  } catch (e) {
    fastify.log?.warn?.('[realtime] socket.io not installed. Run: npm install socket.io');
    console.warn('[realtime] socket.io not installed. Run: npm install socket.io');
    return; // no-op; keep server running without realtime
  }

  const io = new Server(fastify.server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // In-memory jackpot state (authoritative)
  let state = null;
  let history = []; // will be loaded from disk
  let tickTimer = null;
  let botTimers = [];
  let roundEnding = false; // Flag to prevent joins during spinner/end phase

  // Resolve history file path next to this module
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const HISTORY_PATH = path.join(__dirname, 'jackpot_history.json');

  async function loadHistoryFromFile() {
    try {
      const data = await fs.readFile(HISTORY_PATH, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (e) {
      // File may not exist on first run; that's fine
      return [];
    }
  }

  async function saveHistoryToFile(items) {
    try {
      const json = JSON.stringify(items, null, 2);
      await fs.writeFile(HISTORY_PATH, json, 'utf8');
    } catch (e) {
      fastify.log?.warn?.(`[realtime] Failed to write history: ${e.message}`);
    }
  }

  // Admin authentication
  const ADMIN_PASSWORD = 'vc05rWrCImFyfKTT'; // In production, use environment variables
  const adminSessions = new Set(); // Store authenticated admin session IDs

  function newSecret() {
    const secret = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const gameInfo = {
      timestamp: Date.now(),
      serverSeed: secret,
      roundId: Date.now().toString()
    };
    return { secret, hash, gameInfo };
  }

  function resetRound() {
    const { secret, hash, gameInfo } = newSecret();
    state = {
      id: Date.now().toString(),
      players: [],
      totalPot: 0,
      isActive: true,
      startTime: Date.now(),
      endTime: null,
      winner: null,
      countdown: 60,
      secret,
      hash,
      gameInfo,
    };
    // Clear any previous bot timers
    botTimers.forEach(t => clearTimeout(t));
    botTimers = [];
    
    // Broadcast empty state immediately to clear UI
    console.log('🧹 Broadcasting empty pot state');
    io.emit('game_state', state);
    
    // Schedule new bots for this round
    scheduleBotsForRound();
  }

  function broadcastState() {
    io.emit('game_state', {
      id: state.id,
      players: state.players.map(p => ({ id: p.id, name: p.name, betAmount: p.betAmount, isBot: p.isBot })),
      totalPot: state.totalPot,
      isActive: state.isActive,
      countdown: state.countdown,
      hash: state.hash,
      startTime: state.startTime,
    });
  }

  function pickWinner() {
    const realPlayers = state.players.filter(p => !p.isBot);
    
    // If there are real players, guarantee one of them wins
    if (realPlayers.length > 0) {
      console.log('🎯 Real players present - guaranteeing real player win');
      // Weighted selection among real players only
      const total = realPlayers.reduce((s, p) => s + p.betAmount, 0);
      let r = Math.random() * total;
      for (const p of realPlayers) {
        r -= p.betAmount;
        if (r <= 0) return p;
      }
      return realPlayers[realPlayers.length - 1];
    }
    
    // Only if no real players, allow bots to win
    if (state.players.length === 0) return null;
    console.log('🤖 No real players - allowing bot to win');
    
    // Weighted selection among bots
    const total = state.players.reduce((s, p) => s + p.betAmount, 0);
    let r = Math.random() * total;
    for (const p of state.players) {
      r -= p.betAmount;
      if (r <= 0) return p;
    }
    return state.players[state.players.length - 1];
  }

  function endRoundAndReveal() {
    state.isActive = false;
    state.endTime = Date.now();
    // Stop any scheduled bot joins
    botTimers.forEach(t => clearTimeout(t));
    botTimers = [];
    
    // Don't pick winner yet - let spinner determine it
    const entry = {
      id: state.id,
      time: state.endTime,
      totalPot: state.totalPot,
      winner: null, // Will be set by spinner result
      secret: state.secret,
      hash: state.hash,
    };

    // Determine if we should force a real player to win
    const realPlayers = state.players.filter(p => !p.isBot);
    let forcedWinner = null;
    
    if (realPlayers.length > 0) {
      // Pick a real player to guarantee wins
      forcedWinner = pickWinner();
      console.log('🎯 Forcing real player to win:', forcedWinner.name);
    }
    
    // Emit spinner_start with forced winner if real players exist
    console.log('🎰 Server emitting spinner_start');
    io.emit('spinner_start', { 
      players: state.players,
      forcedWinner: forcedWinner
    });
    
    // Wait for spinner result from client, then emit round_result
    // This will be handled by a new socket event from the client
  }

  function startLoop() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (!state?.isActive) return;
      
      // Only start countdown when we have at least 2 total participants
      const totalCount = state.players.length;
      if (totalCount < 2) {
        state.countdown = 60;
        return;
      }

      state.countdown -= 1;
      io.emit('countdown_tick', { secondsLeft: state.countdown });
      if (state.countdown <= 0) {
        endRoundAndReveal();
        // Longer delay to allow spinner animation to complete
        setTimeout(() => {
          resetRound();
          broadcastState();
        }, 18000); // 12 seconds total: 8s spinner + 4s buffer
      }
    }, 1000);
  }

  // Initialize first round
  // Load any existing history from disk (non-blocking for failures)
  history = await loadHistoryFromFile();
  resetRound();
  startLoop();

  io.on('connection', (socket) => {
    // Send current state immediately
    socket.emit('game_state', {
      id: state.id,
      players: state.players.map(p => ({ id: p.id, name: p.name, betAmount: p.betAmount, isBot: p.isBot })),
      totalPot: state.totalPot,
      isActive: state.isActive,
      countdown: state.countdown,
      hash: state.hash,
      startTime: state.startTime,
      history: history,
    });

    socket.on('join_game', (payload) => {
      if (!state?.isActive) return;
      const betAmount = Math.max(0, Number(payload?.betAmount) || 0);
      if (betAmount <= 0) return;

      const player = {
        id: payload?.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: payload?.name || 'Anonymous',
        betAmount: betAmount,
        isBot: !!payload?.isBot,
      };
      state.players.push(player);
      state.totalPot = Number((state.totalPot + betAmount).toFixed(2));

      io.emit('player_joined', { player, totalPot: state.totalPot });
      io.emit('pot_updated', { totalPot: state.totalPot });
      broadcastState();
    });

    socket.on('request_history', () => {
      socket.emit('history_update', { history });
    });

    // Admin authentication
    socket.on('admin_login', ({ password }) => {
      if (password === ADMIN_PASSWORD) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        adminSessions.add(sessionId);
        socket.adminSessionId = sessionId;
        socket.isAdmin = true;
        console.log('🔐 Admin authenticated successfully');
        socket.emit('admin_auth_success', { sessionId });
      } else {
        console.log('❌ Admin authentication failed');
        socket.emit('admin_auth_failed', { error: 'Invalid password' });
      }
    });

    // Admin-only actions
    socket.on('admin_join_game', ({ name, betAmount, sessionId }) => {
      if (!socket.isAdmin || !adminSessions.has(sessionId)) {
        socket.emit('admin_action_denied', { error: 'Not authenticated as admin' });
        return;
      }

      if (!state?.isActive || roundEnding) {
        socket.emit('admin_action_denied', { error: 'Cannot join - round not active or ending' });
        return;
      }

      const player = {
        id: `admin_${Date.now()}`,
        name: name || 'Admin_Player',
        betAmount: Number(betAmount) || 50,
        isBot: false,
        isAdmin: true
      };

      state.players.push(player);
      state.totalPot = Number((state.totalPot + player.betAmount).toFixed(2));
      
      console.log('👑 Admin joined game:', player.name, '$' + player.betAmount);
      io.emit('player_joined', { player, totalPot: state.totalPot });
      io.emit('pot_updated', { totalPot: state.totalPot });
      broadcastState();
    });

    socket.on('admin_set_balance', ({ amount, sessionId }) => {
      if (!socket.isAdmin || !adminSessions.has(sessionId)) {
        socket.emit('admin_action_denied', { error: 'Not authenticated as admin' });
        return;
      }
      
      // This is a mock action - in a real system you'd update a database
      console.log('💰 Admin set balance to:', amount);
      socket.emit('admin_balance_updated', { newBalance: amount });
    });

    socket.on('spinner_result', ({ winner }) => {
      console.log('📡 Received spinner result from client:', winner.name);
      
      // Set the winner determined by spinner physics
      state.winner = winner;
      state.endTime = Date.now();
      
      if (state.winner) {
        const entry = {
          id: state.id,
          players: state.players,
          totalPot: state.totalPot,
          winner: state.winner,
          secret: state.secret,
          hash: state.hash,
          endTime: state.endTime,
          gameInfo: {
            ...state.gameInfo,
            endTime: state.endTime,
            playerCount: state.players.length,
            realPlayers: state.players.filter(p => !p.isBot).length,
            botPlayers: state.players.filter(p => p.isBot).length,
            winnerType: state.winner.isBot ? 'bot' : 'real',
            fairnessProof: {
              serverSeed: state.secret,
              hash: state.hash,
              timestamp: state.gameInfo.timestamp,
              verificationUrl: `/verify-game/${state.id}`
            }
          },
        };
        
        history.unshift(entry);
        if (history.length > 50) history.pop();
        
        // Emit round result with complete game information
        console.log('🏆 Server emitting round_result with spinner-determined winner');
        io.emit('round_result', entry);
      }
      
      // Persist history to disk
      saveHistoryToFile(history);
      
      // Start new round after delay
      setTimeout(() => {
        resetRound();
        broadcastState();
      }, 25000);
    });

    socket.on('disconnect', () => {
      // no-op; we keep players for the round once joined
    });
  });

  fastify.log?.info?.('[realtime] Socket.IO realtime jackpot enabled');

  // --------------------
  // Bot Scheduling Logic
  // --------------------
  const botNames = [
    'Alex_Gaming','Mike_CS','Sarah_Pro','David_Trader','Emma_Skins',
    'Jake_Winner','Lisa_Lucky','Ryan_Beast','Anna_Fire','Tom_Legend',
    'Sophia_Ace','Chris_Master','Maya_Sharp','Luke_Flash','Zoe_Clutch',
    'Noah_Strike','Ava_Sniper','Ethan_Rush','Mia_Bomb','Owen_Knife'
  ];

  function randInt(min, max) { // inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function scheduleBotsForRound() {
    // Choose jackpot type -> influences # of bots and bet sizes
    const jackpotType = Math.random();
    let numBots, betRange;
    if (jackpotType < 0.15) {
      // Small jackpot scenario
      numBots = randInt(2, 4);
      betRange = { min: 8, max: 25 };
    } else {
      // More common medium/large scenario
      numBots = randInt(4, 9);
      betRange = { min: 15, max: 45 };
    }

    // Add initial delay of 5-10 seconds before any bots join
    const initialDelay = randInt(5000, 10000);
    
    // Distribute join times across the first 50 seconds with clustering, after initial delay
    for (let i = 0; i < numBots; i++) {
      let joinMs;
      if (i < 2) {
        // early entrants after initial delay
        joinMs = initialDelay + randInt(500, 10_000);
      } else if (i < 4) {
        // mid timing
        joinMs = initialDelay + randInt(10_000, 30_000);
      } else {
        // late timing
        joinMs = initialDelay + randInt(20_000, 50_000);
      }

      const timer = setTimeout(() => {
        // Only join if round still active and enough time left
        if (!state?.isActive) return;
        if (state.countdown <= 5) return; // avoid last-second joins

        const nameBase = botNames[randInt(0, botNames.length - 1)];
        const player = {
          id: `bot_${Date.now()}_${i}`,
          name: `${nameBase}${randInt(10, 999)}`,
          betAmount: randInt(betRange.min, betRange.max),
          isBot: true,
        };

        state.players.push(player);
        state.totalPot = Number((state.totalPot + player.betAmount).toFixed(2));
        io.emit('player_joined', { player, totalPot: state.totalPot });
        io.emit('pot_updated', { totalPot: state.totalPot });
        broadcastState();
      }, joinMs);

      botTimers.push(timer);
    }
  }
}
