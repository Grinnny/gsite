// Realtime jackpot server using Socket.IO (optional)
// This module safely enables realtime if 'socket.io' is installed.
// It keeps all state in memory to satisfy: no shared DB, local-only history.

import crypto from 'crypto';
import fs from 'fs';
import SteamAuth from './steam-auth.js';
import path from 'node:path';
import { fileURLToPath } from 'url';

export async function initRealtime(fastify, steamAuthInstance) {
  // Use the shared Steam authentication instance
  const steamAuth = steamAuthInstance;
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
  let recentBots = new Set(); // Track bots that have played recently
  
  // Chat system
  let chatMessages = [];
  let chatBotTimers = [];
  const MAX_CHAT_MESSAGES = 100;

  // Resolve history file path next to this module
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const HISTORY_PATH = path.join(__dirname, 'jackpot_history.json');
  const BOTS_PATH = path.join(__dirname, 'static', 'json', 'bots.json');

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
      await fs.promises.writeFile(HISTORY_PATH, json, 'utf8');
      console.log(`💾 Successfully saved ${items.length} games to history file`);
    } catch (e) {
      console.error(`❌ Failed to write history: ${e.message}`);
      fastify.log?.warn?.(`[realtime] Failed to write history: ${e.message}`);
    }
  }

  async function loadBotsFromFile() {
    try {
      console.log('🔍 Loading bots from:', BOTS_PATH);
      
      // Use fs.promises for proper async/await
      const data = await fs.promises.readFile(BOTS_PATH, 'utf8');
      const parsed = JSON.parse(data);
      
      console.log('✅ Successfully loaded bots from file');
      console.log('🤖 Bot data:', parsed);
      console.log('🤖 Number of bots:', parsed.bots?.length || 0);
      
      if (!parsed.bots || !Array.isArray(parsed.bots) || parsed.bots.length === 0) {
        console.error('❌ No valid bots array found in bots.json');
        return [];
      }
      
      return parsed.bots;
    } catch (error) {
      console.error('❌ Failed to load bots:', error.message);
      console.error('📁 Tried to load from:', BOTS_PATH);
      
      // Return empty array - no fallback bots
      return [];
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
      id: crypto.randomBytes(8).toString('hex'),
      players: [],
      totalPot: 0,
      isActive: true,
      countdown: 120, // 2 minutes
      hash: hash,
      secret: secret,
      gameInfo: gameInfo,
      startTime: Date.now(),
      endTime: null,
      winner: null,
    };
    roundEnding = false;
    
    // Gradually forget old bots to allow new ones to join (keep last 20 bots)
    if (recentBots.size > 20) {
      const botsArray = Array.from(recentBots);
      const toRemove = botsArray.slice(0, botsArray.length - 20);
      toRemove.forEach(botId => recentBots.delete(botId));
    }
    
    // Broadcast empty state immediately to clear UI
    console.log('🧹 Broadcasting empty pot state');
    io.emit('game_state', state);
    
    // Schedule new bots for this round
    scheduleBotsForRound();
    
    // Schedule bot chat messages for this round
    scheduleBotChatMessages();
  }

  function broadcastState() {
    io.emit('game_state', {
      id: state.id,
      players: state.players.map(p => ({ 
        id: p.id, 
        name: p.name, 
        betAmount: p.betAmount, 
        avatar: p.avatar,
        profileUrl: p.profileUrl,
        isBot: p.isBot
      })),
      totalPot: state.totalPot,
      isActive: state.isActive,
      countdown: state.countdown,
      hash: state.hash,
      startTime: state.startTime,
      history: history,
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
    
    // Set a fallback timer in case no spinner result is received (client disconnected/refreshed)
    setTimeout(() => {
      if (state && !state.winner && state.isActive === false) {
        console.log('⏰ No spinner result received - server determining winner as fallback');
        const serverWinner = pickWinner();
        
        if (serverWinner) {
          state.winner = serverWinner;
          
          const entry = {
            id: state.id,
            players: state.players.map(p => ({
              id: p.id,
              name: p.name,
              betAmount: p.betAmount,
              avatar: p.avatar,
              profileUrl: p.profileUrl,
              steamId: p.steamId,
              isBot: p.isBot
            })),
            totalPot: state.totalPot,
            winner: state.winner,
            secret: state.secret,
            hash: state.hash,
            startTime: state.startTime,
            endTime: Date.now(),
            timestamp: Date.now(), // For compatibility
            secretRevealed: true,
            playersCount: state.players.length,
            gameInfo: {
              ...state.gameInfo,
              endTime: Date.now(),
              playerCount: state.players.length,
              serverFallback: true,
              fairnessProof: {
                serverSeed: state.secret,
                hash: state.hash,
                timestamp: state.gameInfo.timestamp,
                verificationUrl: `/verify-game/${state.id}`
              }
            },
          };
          
          // Check for duplicate before adding to history
          if (!history.some(h => h.id === entry.id)) {
            history.unshift(entry);
            if (history.length > 50) history.pop();
          }
          
          console.log('🏆 Server emitting round_result (fallback)');
          io.emit('round_result', entry);
          
          // Persist history to disk
          console.log('💾 Saving fallback game to history');
          console.log('📊 Current history length:', history.length);
          console.log('🎮 Fallback game being saved:', entry.id, 'Winner:', entry.winner?.name);
          saveHistoryToFile(history);
          
          // Wait 10 seconds after server fallback before clearing pot
          setTimeout(() => {
            console.log('🧹 Clearing pot 10 seconds after server fallback');
            resetRound();
            broadcastState();
          }, 10000);
        }
      }
    }, 15000); // 15 second fallback timeout
    
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
        // Note: Pot clearing now handled by spinner_result event after spinner fully completes
      }
    }, 1000);
  }

  // Initialize first round
  // Load any existing history from disk (non-blocking for failures)
  history = await loadHistoryFromFile();
  
  // Load bots data
  const availableBots = await loadBotsFromFile();
  console.log(`🤖 Loaded ${availableBots.length} bots from bots.json`);
  
  // Chat message templates
  const chatTemplates = [
    "gl everyone!",
    "nice pot",
    "let's go!",
    "good luck all",
    "big pot incoming",
    "feeling lucky today",
    "this is it!",
    "let's get this W",
    "huge pot",
    "gg wp",
    "nice game",
    "congrats winner!",
    "unlucky",
    "next round for sure",
    "almost had it",
    "close one",
    "gg all",
    "wp everyone"
  ];

  function getRandomChatMessage() {
    return chatTemplates[Math.floor(Math.random() * chatTemplates.length)];
  }

  function addChatMessage(user, message, isBot = false) {
    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        profileUrl: user.profileUrl
      },
      message: message,
      timestamp: Date.now(),
      isBot: isBot
    };

    chatMessages.unshift(chatMessage);
    if (chatMessages.length > MAX_CHAT_MESSAGES) {
      chatMessages.pop();
    }

    // Broadcast to all clients (hide isBot property)
    io.emit('chat_message', {
      id: chatMessage.id,
      user: chatMessage.user,
      message: chatMessage.message,
      timestamp: chatMessage.timestamp
    });
  }

  function scheduleBotChatMessages() {
    // Clear existing chat timers
    chatBotTimers.forEach(timer => clearTimeout(timer));
    chatBotTimers = [];

    if (availableBots.length === 0) return;

    // Create weighted bot pool - bots who recently joined have higher chance
    const weightedBots = [];
    const recentPlayers = state.players.filter(p => p.isBot);
    
    // Add recent jackpot participants with higher weight (3x chance)
    recentPlayers.forEach(player => {
      const bot = availableBots.find(b => b.id === player.id);
      if (bot) {
        weightedBots.push(bot, bot, bot); // Add 3 times for higher chance
      }
    });
    
    // Add all other bots once
    availableBots.forEach(bot => {
      if (!recentPlayers.find(p => p.id === bot.id)) {
        weightedBots.push(bot);
      }
    });

    // Schedule continuous bot chat messages every 5-30 seconds
    function scheduleNextMessage() {
      if (!state?.isActive) return;
      
      const delay = Math.random() * 25000 + 5000; // 5-30 seconds
      const randomBot = weightedBots[Math.floor(Math.random() * weightedBots.length)];
      
      const timer = setTimeout(() => {
        if (state?.isActive) {
          addChatMessage(randomBot, getRandomChatMessage(), true);
          scheduleNextMessage(); // Schedule the next message
        }
      }, delay);
      
      chatBotTimers.push(timer);
    }
    
    // Start the continuous chat cycle
    scheduleNextMessage();
  }
  
  resetRound();
  startLoop();

  io.on('connection', (socket) => {
    // Send current state immediately
    socket.emit('game_state', {
      id: state.id,
      players: state.players.map(p => ({ 
        id: p.id, 
        name: p.name, 
        betAmount: p.betAmount, 
        avatar: p.avatar,
        profileUrl: p.profileUrl,
        isBot: p.isBot
      })),
      totalPot: state.totalPot,
      isActive: state.isActive,
      countdown: state.countdown,
      hash: state.hash,
      startTime: state.startTime,
      history: history,
    });

    // Send chat history to new connections
    socket.emit('chat_history', { messages: chatMessages.slice(0, 20) });

    socket.on('join_game', (payload) => {
      if (!state?.isActive) return;
      
      // Check if user is authenticated (has valid Steam session)
      const sessionId = socket.handshake.headers.cookie?.match(/steam_session=([^;]+)/)?.[1];
      if (!sessionId) {
        socket.emit('join_game_error', { error: 'Authentication required. Please login with Steam.' });
        return;
      }
      
      // Verify session with Steam auth
      const session = steamAuth.getSession(sessionId);
      if (!session) {
        socket.emit('join_game_error', { error: 'Invalid session. Please login again.' });
        return;
      }
      
      const betAmount = Math.max(0, Number(payload?.betAmount) || 0);
      if (betAmount <= 0) return;

      const player = {
        id: payload?.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: session.profile.personaname || 'Player', // Use Steam username
        betAmount: betAmount,
        isBot: false, // Real authenticated players are never bots
        steamId: session.steamId,
        avatar: session.profile.avatar
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

    // Handle user chat messages
    socket.on('send_chat_message', ({ message }) => {
      // Check if user is authenticated
      const sessionId = socket.handshake.headers.cookie?.match(/steam_session=([^;]+)/)?.[1];
      if (!sessionId) {
        socket.emit('chat_error', { error: 'Authentication required to chat.' });
        return;
      }
      
      // Verify session with Steam auth
      const session = steamAuth.getSession(sessionId);
      if (!session) {
        socket.emit('chat_error', { error: 'Invalid session. Please login again.' });
        return;
      }

      // Basic message validation
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return;
      }

      // Limit message length
      const cleanMessage = message.trim().slice(0, 200);

      const user = {
        id: session.steamId,
        name: session.profile.personaname || 'Player',
        avatar: session.profile.avatar,
        profileUrl: `https://steamcommunity.com/profiles/${session.steamId}`
      };

      addChatMessage(user, cleanMessage, false);
    });

    // Handle chat history requests
    socket.on('request_chat_history', () => {
      socket.emit('chat_history', { messages: chatMessages.slice(0, 20) });
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

    // Handle spinner interruption (page refresh/leave)
    socket.on('spinner_interrupted', ({ reason, currentRotation }) => {
      console.log('⚠️ Spinner interrupted:', reason);
      
      // Server decides winner when client can't complete spinner
      if (state && state.isActive === false && !state.winner) {
        console.log('🎲 Server determining winner due to spinner interruption');
        const serverWinner = pickWinner();
        
        if (serverWinner) {
          state.winner = serverWinner;
          state.endTime = Date.now();
          
          const entry = {
            id: state.id,
            players: state.players.map(p => ({
              id: p.id,
              name: p.name,
              betAmount: p.betAmount,
              avatar: p.avatar,
              profileUrl: p.profileUrl,
              steamId: p.steamId,
              isBot: p.isBot
            })),
            totalPot: state.totalPot,
            winner: state.winner,
            secret: state.secret,
            hash: state.hash,
            startTime: state.startTime,
            endTime: state.endTime,
            timestamp: state.endTime, // For compatibility
            secretRevealed: true,
            playersCount: state.players.length,
            gameInfo: {
              ...state.gameInfo,
              endTime: state.endTime,
              playerCount: state.players.length,
              interruptedSpinner: true,
              interruptionReason: reason,
              fairnessProof: {
                serverSeed: state.secret,
                hash: state.hash,
                timestamp: state.gameInfo.timestamp,
                verificationUrl: `/verify-game/${state.id}`
              }
            },
          };
          
          // Check for duplicate before adding to history
          if (!history.some(h => h.id === entry.id)) {
            history.unshift(entry);
            if (history.length > 50) history.pop();
          }
          
          console.log('🏆 Server emitting round_result (spinner interrupted)');
          io.emit('round_result', entry);
          
          // Persist history to disk
          console.log('💾 Saving interrupted game to history');
          console.log('📊 Current history length:', history.length);
          console.log('🎮 Interrupted game being saved:', entry.id, 'Winner:', entry.winner?.name);
          saveHistoryToFile(history);
          
          // Wait 10 seconds after spinner interruption before clearing pot
          setTimeout(() => {
            console.log('🧹 Clearing pot 10 seconds after server-determined winner');
            resetRound();
            broadcastState();
          }, 10000);
        }
      }
    });

    socket.on('spinner_result', ({ winner }) => {
      console.log('📡 Received spinner result from client:', winner.name);
      
      // Set the winner determined by spinner physics
      state.winner = winner;
      state.endTime = Date.now();
      
      if (state.winner) {
        const entry = {
          id: state.id,
          players: state.players.map(p => ({
            id: p.id,
            name: p.name,
            betAmount: p.betAmount,
            avatar: p.avatar,
            profileUrl: p.profileUrl,
            steamId: p.steamId,
            isBot: p.isBot
          })),
          totalPot: state.totalPot,
          winner: state.winner,
          secret: state.secret,
          hash: state.hash,
          startTime: state.startTime,
          endTime: state.endTime,
          timestamp: state.endTime, // For compatibility
          secretRevealed: true,
          playersCount: state.players.length,
          gameInfo: {
            ...state.gameInfo,
            endTime: state.endTime,
            playerCount: state.players.length,
            fairnessProof: {
              serverSeed: state.secret,
              hash: state.hash,
              timestamp: state.gameInfo.timestamp,
              verificationUrl: `/verify-game/${state.id}`
            }
          },
        };
        
        // Check for duplicate before adding to history
        if (!history.some(h => h.id === entry.id)) {
          history.unshift(entry);
          if (history.length > 50) history.pop();
        }
        
        // Emit round result with complete game information
        console.log('🏆 Server emitting round_result with spinner-determined winner');
        io.emit('round_result', entry);
        
        // Save to disk immediately for spinner results
        console.log('💾 Saving game history to disk after spinner result');
        console.log('📊 Current history length:', history.length);
        console.log('🎮 Game being saved:', entry.id, 'Winner:', entry.winner?.name);
        saveHistoryToFile(history);
      }
    });

    // Handle when spinner has stopped spinning (new event)
    socket.on('spinner_stopped', () => {
      console.log('🛑 Spinner has stopped - waiting 10 seconds before clearing pot');
      
      // Wait 10 seconds after spinner stops before clearing pot
      setTimeout(() => {
        console.log('🧹 Clearing pot 10 seconds after spinner stopped');
        resetRound();
        broadcastState();
      }, 10000);
    });

    socket.on('disconnect', () => {
      // no-op; we keep players for the round once joined
    });
  });

  fastify.log?.info?.('[realtime] Socket.IO realtime jackpot enabled');

  // --------------------
  // Bot Scheduling Logic
  // --------------------
  function randInt(min, max) { // inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function scheduleBotsForRound() {
    // Choose jackpot type -> influences # of bots and bet sizes
    const jackpotType = Math.random();
    let numBots, betRange;
    if (jackpotType < 0.2) {
      // Small jackpot scenario
      numBots = randInt(2, 3);
      betRange = { min: 8, max: 25 };
    } else if (jackpotType < 0.6) {
      // Medium jackpot scenario
      numBots = randInt(3, 5);
      betRange = { min: 15, max: 35 };
    } else {
      // Large jackpot scenario
      numBots = randInt(5, 7);
      betRange = { min: 20, max: 45 };
    }

    // Ensure we don't exceed available bots
    numBots = Math.min(numBots, availableBots.length);

    // Add initial delay of 5-10 seconds before any bots join
    const initialDelay = randInt(5000, 10000);
    
    // Create weighted bot selection - recent bots have higher chance
    const weightedBots = [];
    
    // Add recent bots multiple times to increase their selection probability
    availableBots.forEach(bot => {
      if (recentBots.has(bot.id)) {
        // Recent bots get added 4 times (4x more likely to be selected)
        weightedBots.push(bot, bot, bot, bot);
      } else {
        // New bots get added once
        weightedBots.push(bot);
      }
    });
    
    // Shuffle the weighted array
    const shuffledBots = [...weightedBots].sort(() => Math.random() - 0.5);
    
    // Remove duplicates while preserving weighted selection order
    const selectedBots = [];
    const usedBotIds = new Set();
    
    for (const bot of shuffledBots) {
      if (!usedBotIds.has(bot.id) && selectedBots.length < numBots) {
        selectedBots.push(bot);
        usedBotIds.add(bot.id);
      }
    }
    
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

        const selectedBot = selectedBots[i];
        const player = {
          id: selectedBot.id,
          name: selectedBot.name,
          betAmount: randInt(betRange.min, betRange.max),
          isBot: true,
          avatar: selectedBot.avatar, // Include avatar for frontend display
          profileUrl: selectedBot.profileUrl // Include profile URL for clickable links
        };

        state.players.push(player);
        state.totalPot = Number((state.totalPot + player.betAmount).toFixed(2));
        
        // Add this bot to recent bots list
        recentBots.add(selectedBot.id);
        
        console.log(`🤖 Bot ${player.name} joined with $${player.betAmount} - Total pot: $${state.totalPot}`);
        io.emit('player_joined', { player, totalPot: state.totalPot });
        io.emit('pot_updated', { totalPot: state.totalPot });
        broadcastState();
      }, joinMs);

      botTimers.push(timer);
    }
  }
}
