import fs from 'fs';
import path from 'path';
import https from 'https';

function addNewBot(name, avatar, profileUrl = null, existingBotsPath = null) {
    let existingBots = { bots: [] };
    
    if (existingBotsPath && fs.existsSync(existingBotsPath)) {
        const existingData = fs.readFileSync(existingBotsPath, 'utf8');
        existingBots = JSON.parse(existingData);
    }
    
    const nextId = `bot_${existingBots.bots.length + 1}`;
    const newBot = {
        id: nextId,
        name: name,
        avatar: avatar,
        profileUrl: profileUrl
    };
    
    existingBots.bots.push(newBot);
    
    if (existingBotsPath) {
        fs.writeFileSync(existingBotsPath, JSON.stringify(existingBots, null, 2), 'utf8');
        console.log(`✅ Added new bot: ${name} with ID: ${nextId}`);
        console.log(`🔗 Profile URL: ${profileUrl || 'N/A'}`);
    }
    
    return existingBots;
}

async function getSteamPlayerInfo(steamId, apiKey) {
    return new Promise((resolve, reject) => {
        if (!apiKey) {
            reject(new Error('Steam API key is required. Get one from https://steamcommunity.com/dev/apikey'));
            return;
        }

        const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.response && response.response.players && response.response.players.length > 0) {
                        const player = response.response.players[0];
                        
                        resolve({
                            steamId: player.steamid,
                            name: player.personaname,
                            avatar: player.avatarfull,
                            profileUrl: player.profileurl,
                            realName: player.realname || null,
                            countryCode: player.loccountrycode || null,
                            stateCode: player.locstatecode || null
                        });
                    } else {
                        reject(new Error('Player not found or profile is private'));
                    }
                } catch (error) {
                    reject(new Error('Failed to parse Steam API response: ' + error.message));
                }
            });
        }).on('error', (error) => {
            reject(new Error('Steam API request failed: ' + error.message));
        });
    });
}

async function addBotFromSteamId(steamId, apiKey, existingBotsPath = null) {
    try {
        console.log(`🔍 Fetching Steam profile for ID: ${steamId}`);
        const playerInfo = await getSteamPlayerInfo(steamId, apiKey);
        
        console.log(`✅ Found player: ${playerInfo.name}`);
        console.log(`🖼️ Avatar: ${playerInfo.avatar}`);
        console.log(`🔗 Profile: ${playerInfo.profileUrl}`);
        
        const result = addNewBot(playerInfo.name, playerInfo.avatar, playerInfo.profileUrl, existingBotsPath);
        
        return {
            success: true,
            playerInfo: playerInfo,
            botsData: result
        };
    } catch (error) {
        console.error(`❌ Error fetching Steam profile: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// Usage examples:

export {
    getSteamPlayerInfo,
    addBotFromSteamId
};


addBotFromSteamId('76561199429722089', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199387893847', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('1606514415', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199356958595', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198866986763', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('baokin09', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199470234217', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198930501954', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Ali0109', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199165868398', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('lifeisbeautifulll', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('abstarx', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('walrussss', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198910731808', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198910731808', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198180917363', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('911_GUP', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('VinneeL', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('KazuoArtz', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Rick29197726533', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198353987646', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199362273133', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198396695420', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198322231544', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199031261786', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198148407637', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199160201064', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199057946492', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('sheesherslol', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199121904209', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198075536517', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('DrMalcontent', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198291758917', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('jailbaits', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199013304159', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('HighbornEagle52', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198037856496', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198867818579', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199177466313', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198355092583', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199326022630', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('dabbing253', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199004605724', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199032789914', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Pingpongmaster18', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('mmaddzz', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Despectors1337', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('swh_kingxiv', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199013492354', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('charis1222', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199171631025', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198075838233', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199772069592', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('MrKualaPT', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199091582778', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199529342676', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199007647929', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198310775498', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199483800947', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199631973342', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198342731823', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('oldjonn', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('moderndaydeity', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('littlejohhnyy', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Hypepro', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199153938881', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199013463253', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198819817289', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198273498301', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199676846872', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199128138333', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199441960025', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198313648096', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199219841892', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199245578405', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199072601476', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198193259409', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199558070781', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198975022464', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('r0bertson', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Freerandoplh', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198872363656', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199217820286', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199803066634', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561198988579981', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199067447372', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Revix22', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199225690092', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('constantdystopia', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('fakenewsCNN', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('Shelbydavies', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')
addBotFromSteamId('76561199805333723', '2A9E7F1D5C7437F37E99320C3FEBCE69', './src/static/json/bot.json')