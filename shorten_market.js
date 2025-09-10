import fs from 'fs/promises';

async function shortenMarketFile() {
    try {
        // Read the current marketinfo.json
        const data = await fs.readFile('src/static/json/marketinfo.json', 'utf8');
        const items = JSON.parse(data);
        
        console.log(`📊 Original file has ${items.length} items`);
        
        // Group items by rarity to ensure we keep variety
        const itemsByRarity = {
            legendary: [],
            mythical: [],
            epic: [],
            rare: [],
            uncommon: [],
            common: []
        };
        
        items.forEach(item => {
            if (itemsByRarity[item.rarity]) {
                itemsByRarity[item.rarity].push(item);
            }
        });
        
        // Calculate how many items to keep from each rarity (proportional distribution)
        const targetItems = 1000; // Aiming for ~1000 items which should be ~4k lines with formatting
        const rarityDistribution = {
            legendary: Math.min(25, itemsByRarity.legendary.length), // Keep up to 25 legendary
            mythical: Math.min(50, itemsByRarity.mythical.length), // Keep up to 50 mythical
            epic: Math.min(100, itemsByRarity.epic.length), // Keep up to 100 epic
            rare: Math.min(150, itemsByRarity.rare.length), // Keep up to 150 rare
            uncommon: Math.min(300, itemsByRarity.uncommon.length), // Keep up to 300 uncommon
            common: Math.min(375, itemsByRarity.common.length) // Keep up to 375 common
        };
        
        // Randomly select items from each rarity group
        const selectedItems = [];
        
        Object.entries(rarityDistribution).forEach(([rarity, count]) => {
            const rarityItems = itemsByRarity[rarity];
            if (rarityItems.length > 0) {
                // Shuffle array and take first 'count' items
                const shuffled = [...rarityItems].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);
                selectedItems.push(...selected);
                console.log(`✅ Selected ${selected.length} ${rarity} items`);
            }
        });
        
        // Add "x" to all quantity values and ensure they're strings
        const processedItems = selectedItems.map(item => ({
            ...item,
            quantity: typeof item.quantity === 'string' && item.quantity.endsWith('x') 
                ? item.quantity 
                : `${item.quantity}x`
        }));
        
        // Sort by rarity for better organization (legendary first, common last)
        const rarityOrder = ['legendary', 'mythical', 'epic', 'rare', 'uncommon', 'common'];
        processedItems.sort((a, b) => {
            const aIndex = rarityOrder.indexOf(a.rarity);
            const bIndex = rarityOrder.indexOf(b.rarity);
            return aIndex - bIndex;
        });
        
        // Write the shortened file
        await fs.writeFile(
            'src/static/json/marketinfo.json',
            JSON.stringify(processedItems, null, 4)
        );
        
        console.log(`\n🎉 Successfully shortened marketinfo.json!`);
        console.log(`📉 Reduced from ${items.length} to ${processedItems.length} items`);
        
        // Show final rarity distribution
        const finalRarityCount = {};
        processedItems.forEach(item => {
            finalRarityCount[item.rarity] = (finalRarityCount[item.rarity] || 0) + 1;
        });
        
        console.log('\n📈 Final Rarity Distribution:');
        Object.entries(finalRarityCount).forEach(([rarity, count]) => {
            console.log(`  ${rarity}: ${count} items`);
        });
        
        // Estimate file size
        const fileStats = await fs.stat('src/static/json/marketinfo.json');
        const fileSizeKB = Math.round(fileStats.size / 1024);
        console.log(`\n📁 File size: ${fileSizeKB} KB`);
        
    } catch (error) {
        console.error('❌ Error shortening market file:', error);
    }
}

// Run the script
shortenMarketFile();
