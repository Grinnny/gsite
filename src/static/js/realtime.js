// Realtime bootstrap for ScrapHouse
(function () {
  // Expect Socket.IO client to be loaded via CDN before this script
  if (typeof io === 'undefined') {
    console.warn('[realtime] Socket.IO client not found. Make sure the CDN script is included before realtime.js');
    return;
  }

  const url = window.location.origin; // same host/port as site
  const socket = io(url, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  // Expose globally
  window.socket = socket;

  // Basic lifecycle logs
  socket.on('connect', () => {
    console.log('[realtime] connected', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[realtime] connect_error', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[realtime] disconnected', reason);
  });

  // Generic jackpot events (server will emit these when wired)
  socket.on('game_state', (state) => {
    console.log('[realtime] game_state', state);
  });

  socket.on('player_joined', (payload) => {
    console.log('[realtime] player_joined', payload);
  });

  socket.on('pot_updated', (payload) => {
    console.log('[realtime] pot_updated', payload);
  });

  socket.on('countdown_tick', (payload) => {
    console.log('[realtime] countdown_tick', payload);
  });

  socket.on('round_result', (payload) => {
    console.log('[realtime] round_result', payload);
  });
})();
