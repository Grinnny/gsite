import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import cors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
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

// Deposit tracking system
let userDeposits = new Map(); // steamId -> { addresses: {BTC: '', ETH: '', SOL: ''}, deposits: [] }
let userBalances = new Map(); // steamId -> balance

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

fastify.register(fastifyCookie);
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
	try {
		const filePath = path.join(process.cwd(), 'skinportdata.json');
		const fileContent = await fs.readFile(filePath, 'utf8');
		const data = JSON.parse(fileContent);
		
		if (!Array.isArray(data)) {
			console.error("Skinport data is not an array");
			return null;
		}
		
		let item = data.find(item => item.market_hash_name === itemName);
		if (!item) {
			console.log("Item not found in skinportdata:", itemName);
			return null;
		}
		let suggestedprice = item.suggested_price;
		return suggestedprice;
	} catch (err) {
		console.error("Error fetching data:", err);
		return null;
	}
}

fastify.get('/requestItemPrice', async (req, res) => {

	let parsedUrl = url.parse(req.url, true);
	let urlparam = parsedUrl.query

	let price = await getRustItemPrice(urlparam.itemname)
	if (price === null) {
		res.send({"itemPrice": "$0.00"})
		return
	}
	let result = price
	let string = '{"itemPrice":'+'"$' + result + '"'+'}'
	const jsonstring = JSON.parse(string)
	res.send(jsonstring)

})

async function getImage(itemName) {
	try {
		let response = await fetch("http://localhost:4200" + "/skins.json")
		const data = await response.json();
		const item = data.find(item => item.name === itemName)
		if (!item) {
			console.log("Item not found in skins.json:", itemName)
			return null
		}
		const imgSrc = item.imageUrl
		return imgSrc
	} catch (err) {
		console.error("Error fetching skins.json:", err);
		return null;
	}
}

fastify.get('/requestItemIcon', async (req, res) => { 
	async function getRustIcon(itemName) {
		try {
			const filePath = path.join(process.cwd(), 'skinportdata.json');
			const fileContent = await fs.readFile(filePath, 'utf8');
			const data = JSON.parse(fileContent);
			
			if (!Array.isArray(data)) {
				console.error("Skinport data is not an array");
				return null;
			}

			let item = data.find(item => item.market_hash_name === itemName);
			if (!item) {
				console.log("Item not found in skinportdata for icon:", itemName);
				return null;
			}
			let icon = await getImage(item.market_hash_name);
			if (!icon) {
				return null;
			}
			return(icon);
		} catch (err) {
			console.error("Error fetching data:", err);
			return null;
		}
	}
	let parsedUrl = url.parse(req.url, true);
	let urlparam = parsedUrl.query

	let icon = await getRustIcon(urlparam.itemname)
	if (icon === null) {
		res.send({"iconSrc": "imgs/default-item.png"})
		return
	}
	let result = icon
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
		res.cookie('steam_session', sessionId, {
			httpOnly: true,
			secure: true, // HTTPS in production
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
			path: '/',
			sameSite: 'lax'
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
		// Initialize user balance if not exists
		if (!userBalances.has(session.steamId)) {
			userBalances.set(session.steamId, 0);
		}
		
		res.send({
			success: true,
			user: {
				steamId: session.steamId,
				name: session.profile.personaname,
				avatar: session.profile.avatar,
				profileUrl: session.profile.profileurl,
				balance: userBalances.get(session.steamId) || 0
			}
		});
	} else {
		res.send({ success: false, message: 'Not authenticated' });
	}
});

// API endpoint to get game history for verification
fastify.get('/api/game-history', async (req, res) => {
	try {
		const historyPath = path.join(__dirname, 'jackpot_history.json');
		const data = await fs.readFile(historyPath, 'utf8');
		let history = JSON.parse(data);
		
		// Clean up duplicates and ensure proper structure
		if (Array.isArray(history)) {
			// Remove duplicates based on ID and hash combination
			const seen = new Set();
			history = history.filter(game => {
				const key = `${game.id}-${game.hash}`;
				if (seen.has(key)) {
					return false;
				}
				seen.add(key);
				return true;
			});
			
			// Ensure all games have secretRevealed flag
			history = history.map(game => ({
				...game,
				secretRevealed: game.secret ? true : false
			}));
		}
		
		res.send({ success: true, history: Array.isArray(history) ? history : [] });
	} catch (error) {
		// If file doesn't exist or is invalid, return empty history
		res.send({ success: true, history: [] });
	}
});

// Save user deposit address for tracking
fastify.post('/saveDepositAddress', async (req, res) => {
	const sessionId = req.cookies?.steam_session;
	const session = sessionId ? steamAuth.getSession(sessionId) : null;
	
	if (!session) {
		return res.send({ success: false, message: 'Not authenticated' });
	}
	
	const { userAddress, cryptoType } = req.body;
	
	if (!userAddress || !cryptoType) {
		return res.send({ success: false, message: 'Missing required fields' });
	}
	
	// Validate crypto type
	if (!['BTC', 'ETH', 'SOL'].includes(cryptoType)) {
		return res.send({ success: false, message: 'Invalid crypto type' });
	}
	
	// Initialize user deposit tracking if not exists
	if (!userDeposits.has(session.steamId)) {
		userDeposits.set(session.steamId, {
			addresses: {},
			deposits: []
		});
	}
	
	const userData = userDeposits.get(session.steamId);
	userData.addresses[cryptoType] = userAddress;
	
	console.log(`User ${session.profile.personaname} registered ${cryptoType} address: ${userAddress}`);
	
	res.send({ success: true, message: 'Address saved successfully' });
});

// Check for new deposits
fastify.post('/checkDeposits', async (req, res) => {
	const sessionId = req.cookies?.steam_session;
	const session = sessionId ? steamAuth.getSession(sessionId) : null;
	
	if (!session) {
		return res.send({ success: false, message: 'Not authenticated' });
	}
	
	const { userAddress, cryptoType } = req.body;
	
	if (!userAddress || !cryptoType) {
		return res.send({ success: false, message: 'Missing required fields' });
	}
	
	try {
		// In a real implementation, this would check blockchain APIs
		// For now, we'll simulate deposit detection with a small chance
		const simulateDeposit = Math.random() < 0.1; // 10% chance for demo
		
		if (simulateDeposit) {
			// Simulate a deposit
			const cryptoPrices = {
				'BTC': 45000,
				'ETH': 2500,
				'SOL': 100
			};
			
			const depositAmount = cryptoType === 'BTC' ? 0.001 : 
								  cryptoType === 'ETH' ? 0.01 : 0.1;
			
			const usdValue = depositAmount * cryptoPrices[cryptoType];
			const bonus = usdValue * 0.25; // 25% bonus
			const totalCredit = usdValue + bonus;
			
			// Update user balance
			const currentBalance = userBalances.get(session.steamId) || 0;
			const newBalance = currentBalance + totalCredit;
			userBalances.set(session.steamId, newBalance);
			
			// Record deposit
			const userData = userDeposits.get(session.steamId);
			if (userData) {
				userData.deposits.push({
					cryptoType,
					amount: depositAmount,
					usdValue: usdValue.toFixed(2),
					bonus: bonus.toFixed(2),
					totalCredit: totalCredit.toFixed(2),
					timestamp: new Date(),
					fromAddress: userAddress
				});
			}
			
			console.log(`Deposit detected for ${session.profile.personaname}: ${depositAmount} ${cryptoType} = $${totalCredit.toFixed(2)}`);
			
			res.send({
				success: true,
				newDeposits: [{
					amount: depositAmount,
					usdValue: usdValue.toFixed(2),
					bonus: bonus.toFixed(2),
					totalCredit: totalCredit.toFixed(2)
				}],
				newBalance: newBalance
			});
		} else {
			res.send({ success: true, newDeposits: [] });
		}
	} catch (error) {
		console.error('Error checking deposits:', error);
		res.send({ success: false, message: 'Error checking deposits' });
	}
});

// Get user balance
fastify.get('/balance', async (req, res) => {
	const sessionId = req.cookies?.steam_session;
	const session = sessionId ? steamAuth.getSession(sessionId) : null;
	
	if (!session) {
		return res.send({ success: false, message: 'Not authenticated' });
	}
	
	const balance = userBalances.get(session.steamId) || 0;
	res.send({ success: true, balance: balance });
});

// Initialize realtime features with shared steamAuth instance
initRealtime(fastify, steamAuth);

fastify.listen({port: port}, () => {
    console.log(`listening on port: ${port}`)
    console.log(`view your server at: http://localhost:${port}`)
})