import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import cors from '@fastify/cors'
import url from 'node:url'
import fs from 'fs/promises'
import puppeteer from "puppeteer";
import { initRealtime } from './realtime.js'
import SteamAuth from './steam-auth.js'

// Jackpot game state
let currentJackpot = {
    id: null,
    players: [],
    totalPot: 0,
    isActive: false,
    startTime: null,
    endTime: null,
    winner: null
};

let jackpotHistory = [];
let gameIdCounter = 1;

// Initialize Steam authentication
const steamAuth = new SteamAuth();

const fastify = Fastify({
})

fastify.register(cors, {
      origin: '*', 
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
      allowedHeaders: ['Origin', 'X-Requested-With', 'Accept', 'Content-Type', 'Authorization'], // Allowed headers
      credentials: true 
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let port = 4200

const params = new URLSearchParams({
    app_id: 252490,
    currency: 'USD',
    tradable: 1
});

async function getSkinportData() {
    const response = await fetch(`https://api.skinport.com/v1/items?${params}`, {
        method: 'GET',
        headers: {
            'Accept-Encoding': 'br'
        }
    });

    const data = await response.json();
	try {
		await fs.writeFile('./src/skinportdata.json', JSON.stringify(data), 'utf8');
	} catch (err) {
		console.error(err)
	}
};

// getSkinportData()

fastify.register(fastifyStatic, {
	root: path.join(__dirname, "static"),
	prefix: "/"
})

fastify.get('/uuid', async (req, res) => {
	let uuid = uuidv4()
	let string = '{"UUID":'+'"' + uuid + '"'+'}'
	const jsonuuid = JSON.parse(string)
	res.send(jsonuuid)
})

async function getRustItemPrice(itemName) {
		const url = "http://localhost:4200" + "/skinportdata.json";
		try {
			const response = await fetch(url);
			const data = await response.json();
			let item = data.find(item => item.market_hash_name === itemName)
			let suggestedprice = item.suggested_price
			return suggestedprice
		} catch (er) {
			console.error("Error fetching data:", err);
		}
		return suggestedprice;
	}

fastify.get('/requestItemPrice', async (req, res) => {

	let parsedUrl = url.parse(req.url, true);
	let urlparam = parsedUrl.query

	let price = await getRustItemPrice(urlparam.itemname)
	let result = price
	let string = '{"itemPrice":'+'"$' + result + '"'+'}'
	const jsonstring = JSON.parse(string)
	res.send(jsonstring)

})

async function getImage(itemName) {
  	let response = await fetch("http://localhost:4200" + "/skins.json")
	const data = await response.json();
	const item = data.find(item => item.name === itemName)
	const imgSrc = item.imageUrl
	return imgSrc
	
}

fastify.get('/requestItemIcon', async (req, res) => { 
	async function getRustIcon(itemName) {
		const url = "http://localhost:4200" + "/skinportdata.json";

		try {
			const response = await fetch(url);
			const data = await response.json();

			let item = data.find(item => item.market_hash_name === itemName)
			let icon = await getImage(item.market_hash_name)
			return(icon)
		} catch (err) {
			console.error("Error fetching data:", err);
		}
	}
	let parsedUrl = url.parse(req.url, true);
	let urlparam = parsedUrl.query

	let price = await getRustIcon(urlparam.itemname)
	let result = price
	let string = '{"iconSrc":'+'"' + result + '"'+'}'
	const jsonstring = JSON.parse(string)
	res.send(jsonstring)
})

// Jackpot balance validation endpoint (security-critical)
// Exchange rate API endpoint
fastify.get('/exchangeRates', async (req, res) => {
	try {
		// Fetch exchange rates from CoinGecko API (free tier)
		const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether,litecoin,dogecoin,ripple,binancecoin&vs_currencies=usd');
		const data = await response.json();
		
		// Map to our crypto symbols
		const rates = {
			BTC: data.bitcoin?.usd || 43000,
			ETH: data.ethereum?.usd || 2400,
			SOL: data.solana?.usd || 100,
			USDT: data.tether?.usd || 1,
			LTC: data.litecoin?.usd || 70,
			DOGE: data.dogecoin?.usd || 0.08,
			XRP: data.ripple?.usd || 0.60,
			BNB: data.binancecoin?.usd || 300
		};
		
		res.send({ success: true, rates });
	} catch (error) {
		console.error('Error fetching exchange rates:', error);
		// Fallback rates if API fails
		const fallbackRates = {
			BTC: 43000,
			ETH: 2400,
			SOL: 100,
			USDT: 1,
			LTC: 70,
			DOGE: 0.08,
			XRP: 0.60,
			BNB: 300
		};
		res.send({ success: true, rates: fallbackRates });
	}
});

// Calculate deposit amount with 25% bonus
fastify.post('/calculateDeposit', async (req, res) => {
	try {
		const { cryptoAmount, cryptoSymbol } = req.body;
		
		if (!cryptoAmount || !cryptoSymbol) {
			return res.send({ success: false, message: 'Missing required parameters' });
		}
		
		// Get current exchange rates
		const ratesResponse = await fetch('http://localhost:4200/exchangeRates');
		const ratesData = await ratesResponse.json();
		
		if (!ratesData.success) {
			return res.send({ success: false, message: 'Failed to get exchange rates' });
		}
		
		const rate = ratesData.rates[cryptoSymbol.toUpperCase()];
		if (!rate) {
			return res.send({ success: false, message: 'Unsupported cryptocurrency' });
		}
		
		// Calculate USD value
		const usdValue = parseFloat(cryptoAmount) * rate;
		
		// Check minimum deposit ($5)
		if (usdValue < 5) {
			return res.send({ 
				success: false, 
				message: `Minimum deposit is $5.00 USD (${(5 / rate).toFixed(8)} ${cryptoSymbol.toUpperCase()})` 
			});
		}
		
		// Apply 25% bonus
		const bonusAmount = usdValue * 0.25;
		const totalCredit = usdValue + bonusAmount;
		
		res.send({
			success: true,
			cryptoAmount: parseFloat(cryptoAmount),
			cryptoSymbol: cryptoSymbol.toUpperCase(),
			usdValue: usdValue.toFixed(2),
			bonusAmount: bonusAmount.toFixed(2),
			totalCredit: totalCredit.toFixed(2),
			exchangeRate: rate
		});
		
	} catch (error) {
		console.error('Error calculating deposit:', error);
		res.send({ success: false, message: 'Internal server error' });
	}
});

// Game verification endpoint for provably fair system
fastify.get('/verify-game/:gameId', async (req, res) => {
	try {
		const { gameId } = req.params;
		
		// Load game history to find the specific game
		const historyData = await fs.readFile('./src/jackpot_history.json', 'utf8');
		const history = JSON.parse(historyData);
		
		const game = history.find(g => g.id === gameId);
		
		if (!game) {
			return res.send({ 
				success: false, 
				message: 'Game not found' 
			});
		}
		
		// Verify hash matches secret
		const crypto = await import('node:crypto');
		const computedHash = crypto.createHash('sha256').update(game.secret).digest('hex');
		const hashValid = computedHash === game.hash;
		
		res.send({
			success: true,
			gameId: game.id,
			hash: game.hash,
			secret: game.secret,
			hashValid,
			gameInfo: game.gameInfo || {
				playerCount: game.players.length,
				totalPot: game.totalPot,
				winner: game.winner.name,
				winnerType: game.winner.isBot ? 'bot' : 'real',
				endTime: game.endTime
			},
			players: game.players.map(p => ({
				name: p.name,
				bet: p.bet,
				percentage: p.percentage,
				isBot: p.isBot
			})),
			verification: {
				message: hashValid ? 'Game is provably fair' : 'Hash verification failed',
				instructions: 'You can verify this game by computing SHA256(secret) and comparing with the pre-revealed hash.'
			}
		});
		
	} catch (error) {
		console.error('Error verifying game:', error);
		res.send({ 
			success: false, 
			message: 'Error loading game data' 
		});
	}
});

fastify.post('/validateBalance', async (req, res) => {
	const { betAmount } = req.body;
	
	// In a real implementation, you would validate against user's actual balance
	// For now, we'll simulate a balance check
	const userBalance = 100.00; // Mock balance
	
	if (betAmount <= 0) {
		return res.send({ valid: false, message: 'Bet amount must be greater than 0' });
	}
	
	if (betAmount > userBalance) {
		return res.send({ valid: false, message: 'Insufficient balance' });
	}
	
	res.send({ valid: true, message: 'Balance validated' });
})

// Login page route
fastify.get('/login', async (req, res) => {
	return res.sendFile('login.html');
});

// Steam authentication routes
fastify.get('/auth/steam', async (req, res) => {
	const loginUrl = steamAuth.getLoginUrl();
	res.redirect(loginUrl);
});

fastify.get('/auth/steam/return', async (req, res) => {
	try {
		const steamId = await steamAuth.verifyAssertion(req.query);
		
		if (!steamId) {
			return res.redirect('/login?error=steam_auth_failed');
		}
		
		// Get user profile with Steam API key
		const apiKey = '2A9E7F1D5C7437F37E99320C3FEBCE69';
		const userProfile = await steamAuth.getUserProfile(steamId, apiKey);
		
		if (!userProfile) {
			return res.redirect('/login?error=profile_fetch_failed');
		}
		
		// Create session
		const sessionId = steamAuth.createSession(steamId, userProfile);
		
		// Set session cookie
		res.setCookie('steam_session', sessionId, {
			httpOnly: true,
			secure: false, // Set to true in production with HTTPS
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
			path: '/'
		});
		
		// Redirect to main game page
		res.redirect('/jackpot.html?logged_in=true');
		
	} catch (error) {
		console.error('Steam auth error:', error);
		res.redirect('/login?error=internal_error');
	}
});

fastify.get('/auth/logout', async (req, res) => {
	const sessionId = req.cookies?.steam_session;
	if (sessionId) {
		steamAuth.destroySession(sessionId);
	}
	
	res.clearCookie('steam_session');
	res.redirect('/login');
});

fastify.get('/auth/user', async (req, res) => {
	const sessionId = req.cookies?.steam_session;
	const session = sessionId ? steamAuth.getSession(sessionId) : null;
	
	if (session) {
		res.send({
			success: true,
			user: {
				steamId: session.steamId,
				name: session.profile.personaname,
				avatar: session.profile.avatar,
				profileUrl: session.profile.profileurl
			}
		});
	} else {
		res.send({ success: false, message: 'Not authenticated' });
	}
});

// Initialize realtime jackpot (Socket.IO) if available
await initRealtime(fastify);

fastify.listen({port: port}, () => {
    console.log(`listening on port: ${port}`)
    console.log(`view your server at: http://localhost:${port}`)
})