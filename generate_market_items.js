import fs from 'fs/promises';
import path from 'path';

// Function to determine rarity based on price
function getRarityFromPrice(price) {
    if (price >= 350) return 'legendary';
    if (price >= 100) return 'mythical';
    if (price >= 50) return 'epic';
    if (price >= 25) return 'rare';
    if (price >= 10) return 'uncommon';
    return 'common';
}

// Function to generate random quantity between 1-10
function getRandomQuantity() {
    return Math.floor(Math.random() * 10) + 1;
}

// Function to create a safe ID from item name
function createSafeId(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '');
}

async function generateMarketItems() {
    try {
        // Read skinportdata.json
        const skinportData = JSON.parse(await fs.readFile('skinportdata.json', 'utf8'));
        
        // Read existing marketinfo.json to preserve current items
        let existingItems = [];
        try {
            const existingData = await fs.readFile('src/static/json/marketinfo.json', 'utf8');
            existingItems = JSON.parse(existingData);
        } catch (error) {
            console.log('No existing marketinfo.json found, creating new one');
        }

        // Process skinport items
        const newItems = skinportData.map(item => {
            const price = item.suggested_price || 0;
            const rarity = getRarityFromPrice(price);
            const quantity = getRandomQuantity();
            const id = createSafeId(item.market_hash_name);

            return {
                id: id,
                name: item.market_hash_name,
                quantity: quantity,
                rarity: rarity
            };
        });

        // Combine existing items with new items (avoid duplicates by both name and ID)
        const existingNames = new Set(existingItems.map(item => item.name));
        const existingIds = new Set(existingItems.map(item => item.id));
        const filteredNewItems = newItems.filter(item => 
            !existingNames.has(item.name) && !existingIds.has(item.id)
        );
        
        const allItems = [...existingItems, ...filteredNewItems];

        // Remove any duplicates that might exist in the final array
        const seenIds = new Set();
        const seenNames = new Set();
        const uniqueItems = [];
        
        allItems.forEach(item => {
            if (!seenIds.has(item.id) && !seenNames.has(item.name)) {
                seenIds.add(item.id);
                seenNames.add(item.name);
                uniqueItems.push({
                    ...item,
                    quantity: typeof item.quantity === 'string' && item.quantity.endsWith('x') 
                        ? item.quantity 
                        : `${item.quantity}x`
                });
            }
        });

        // Write to marketinfo.json
        await fs.writeFile(
            'src/static/json/marketinfo.json', 
            JSON.stringify(uniqueItems, null, 4)
        );

        console.log(`✅ Successfully added ${filteredNewItems.length} new items to marketinfo.json`);
        console.log(`📊 Total items in market: ${uniqueItems.length}`);
        console.log(`🧹 Removed ${allItems.length - uniqueItems.length} duplicate items during cleanup`);
        
        // Show rarity distribution
        const rarityCount = {};
        uniqueItems.forEach(item => {
            rarityCount[item.rarity] = (rarityCount[item.rarity] || 0) + 1;
        });
        
        console.log('\n📈 Rarity Distribution:');
        Object.entries(rarityCount).forEach(([rarity, count]) => {
            console.log(`  ${rarity}: ${count} items`);
        });

    } catch (error) {
        console.error('❌ Error generating market items:', error);
    }
}

// Run the script
generateMarketItems();
