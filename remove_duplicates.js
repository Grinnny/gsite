import fs from 'fs/promises';

async function removeDuplicates() {
    try {
        // Read the current marketinfo.json
        const data = await fs.readFile('src/static/json/marketinfo.json', 'utf8');
        const items = JSON.parse(data);
        
        console.log(`📊 Original file has ${items.length} items`);
        
        // Track seen IDs and keep unique items
        const seenIds = new Set();
        const uniqueItems = [];
        const duplicates = [];
        
        items.forEach((item, index) => {
            const itemId = item.id;
            
            if (seenIds.has(itemId)) {
                duplicates.push({ index, id: itemId, name: item.name });
            } else {
                seenIds.add(itemId);
                uniqueItems.push(item);
            }
        });
        
        console.log(`🔍 Found ${duplicates.length} duplicate items`);
        
        if (duplicates.length > 0) {
            console.log('\n📋 Duplicate items found:');
            duplicates.slice(0, 10).forEach(dup => {
                console.log(`  - ID: ${dup.id}, Name: ${dup.name} (index ${dup.index})`);
            });
            
            if (duplicates.length > 10) {
                console.log(`  ... and ${duplicates.length - 10} more duplicates`);
            }
        }
        
        // Write the deduplicated file
        await fs.writeFile(
            'src/static/json/marketinfo.json',
            JSON.stringify(uniqueItems, null, 4)
        );
        
        console.log(`\n✅ Successfully removed duplicates!`);
        console.log(`📉 Reduced from ${items.length} to ${uniqueItems.length} items`);
        console.log(`🗑️ Removed ${items.length - uniqueItems.length} duplicate items`);
        
        // Show rarity distribution of final items
        const rarityCount = {};
        uniqueItems.forEach(item => {
            rarityCount[item.rarity] = (rarityCount[item.rarity] || 0) + 1;
        });
        
        console.log('\n📈 Final Rarity Distribution:');
        Object.entries(rarityCount).forEach(([rarity, count]) => {
            console.log(`  ${rarity}: ${count} items`);
        });
        
        // Estimate file size
        const fileStats = await fs.stat('src/static/json/marketinfo.json');
        const fileSizeKB = Math.round(fileStats.size / 1024);
        console.log(`\n📁 New file size: ${fileSizeKB} KB`);
        
    } catch (error) {
        console.error('❌ Error removing duplicates:', error);
    }
}

// Run the script
removeDuplicates();
