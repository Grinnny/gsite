

async function fetchPrice(itemName) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(window.location.origin+`/requestItemPrice?itemname=${itemName}`, {
            method: "GET",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.text();
        
        // Try to parse as JSON first, then extract price
        try {
            const jsonData = JSON.parse(data);
            if (jsonData.itemPrice) {
                return jsonData.itemPrice;
            }
        } catch (e) {
            // If not JSON, return as is
        }
        
        return data || null;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`Price fetch timeout for ${itemName}`);
        } else {
            console.error(`Error fetching price for ${itemName}:`, error);
        }
        return null;
    }
}

async function fetchIcon(itemName) {
    let origin = window.location.origin;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(origin+`/requestItemIcon?itemname=${itemName}`, {
            method: "GET",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return null;
        }
        const res = await response.json();
        const src = res.iconSrc;
        return src;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`Icon fetch timeout for ${itemName}`);
        } else {
            console.error('Error fetching icon for', itemName, ':', error);
        }
        return null;
    }
}

function getItemRarity(rarity) {
    const rarityrgb = {
        legendary: "rgba(251, 255, 0, 0.2)",
        mythical: "rgba(255, 0, 0, 0.2)",
        epic: "rgba(119, 0, 255, 0.2)",
        rare: "rgba(0, 132, 255, 0.2)",
        uncommon: "rgba(0, 255, 136, 0.2)",
        common: "rgba(154, 206, 255, 0.2)"
    }
    return rarityrgb[rarity] || "rgba(154, 206, 255, 0.2)";
}

/* let MarketData = fetch(window.location.origin + "/json/marketinfo.json")
        .then(res => res.json())
        .then(jsonData => {
             jsonData.forEach(item => {
                console.log(fetchPrice(item.name))
                let itemImgSrc = ''
                let template = `<li style=" cursor: pointer; width: 150px; height: 150px; background-color: #111; border-radius: 10px;" class="relative depoli">
                                    <div class="flex items-center flex-col justify-center" style="width: 100%; height: 100%; z-index: 7;">
                                        <img class="imgdropshadow" src="${itemImgSrc}" style=" width: 50px; height: 50px; z-index: 8;">
                                        <span style="font-size: 19px; z-index: 8; color: #ffffff; font-family: carving; margin-top: 7px;">${item.name}</span>
                                        <span style="font-size: 13px; z-index: 8; color: #4ECCA3; font-family: carving; margin-top: 2px;">$0.00</span>
                                
                                    </div>
                                    <span class="absolute" style="color: #4ECCA3; top: 0; z-index: 10; margin-top: 10px; margin-left: 10px;" > ${item.quanity}</span>
                                    <div class="background-shadow" style="width: 148px; height: 148px; position: absolute; z-index: 4; top:1px; left:1px; border-radius: 10px; border: 2px solid #161616; background-image: radial-gradient(circle at 50% 150%,rgba(154, 206, 255, 0.3),rgba(51, 51, 51, 0.5));" class=""></div>
                                </li>`
             })
         })
*/
// Show loading overlay
function showLoading() {
    const overlay = document.getElementById('market-loading-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('market-loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Batch process items for better performance
function batchProcessItems(items, batchSize = 10) {
    return new Promise((resolve) => {
        let index = 0;
        const results = [];
        
        function processBatch() {
            const batch = items.slice(index, index + batchSize);
            if (batch.length === 0) {
                resolve(results);
                return;
            }
            
            batch.forEach(item => results.push(item));
            index += batchSize;
            
            // Use setTimeout to allow UI updates between batches
            setTimeout(processBatch, 0);
        }
        
        processBatch();
    });
}

async function loadMarketData() {
    try {
        // Show loading spinner
        showLoading();
        
        let jsonRes = await fetch(window.location.origin + "/json/marketinfo.json")
        if (!jsonRes.ok) {
            console.error("Failed to fetch market data");
            hideLoading();
            return;
        }
        const jsonData = await jsonRes.json();
        
        // Limit items for faster loading (take first 150 items)
        const limitedData = jsonData.slice(0, 150);
        
        // Process items in moderate batches for reliability
        const batchSize = 25;
        const totalBatches = Math.ceil(limitedData.length / batchSize);
        let processedCount = 0;
        
        // Create a document fragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < totalBatches; i++) {
            const batch = limitedData.slice(i * batchSize, (i + 1) * batchSize);
            
            // Process batch items concurrently with better error handling
            const batchPromises = batch.map(async (item) => {
                try {
                    // Fetch price and image data with longer timeout for reliability
                    const [price, img] = await Promise.all([
                        fetchPrice(item.name),
                        fetchIcon(item.name)
                    ]);
                    
                    let quantity = item.quantity || 0;

                    // Skip items that failed to load properly
                    if (price === null || img === null) {
                        console.log("Skipping item due to missing data:", item.name);
                        return null;
                    }
                    
                    // Format price if it doesn't already have $ symbol
                    let formattedPrice = price;
                    if (price && !price.toString().startsWith('$')) {
                        formattedPrice = `$${price}`;
                    }

                    let rarity = getItemRarity(item.rarity);
                    
                    return {
                        item,
                        price: formattedPrice,
                        img,
                        quantity,
                        rarity
                    };
                } catch (error) {
                    console.error("Error processing item:", item.name, error);
                    return null;
                }
            });
            
            // Wait for batch to complete
            const batchResults = await Promise.all(batchPromises);
            
            // Create HTML elements for successful items only
            batchResults.forEach(result => {
                if (result) {
                    const { item, price, img, quantity, rarity } = result;
                    
                    const li = document.createElement('li');
                    li.onclick = () => selecteditem(item.name);
                    li.style.cssText = 'cursor: pointer; background-color: #111; border-radius: 10px;';
                    li.className = 'relative depoli';
                    
                    li.innerHTML = `
                        <div class="flex items-center flex-col justify-center" style="width: 100%; height: 100%; z-index: 7;">
                            <img class="imgdropshadow" src="${img}" style=" width: 50px; height: 50px; z-index: 8;" onerror="this.src='imgs/default-item.png'">
                            <span style="text-align: center; font-size: 13px; z-index: 8; color: #ffffff; font-family: carving; margin-top: 7px;">${item.name}</span>
                            <span style="font-size: 13px; z-index: 8; color: #4ECCA3; font-family: carving; margin-top: 2px;">${price}</span>
                        </div>
                        <span class="absolute" style="color: #4ECCA3; top: 0; z-index: 10; margin-top: 10px; margin-left: 10px;" id="${item.name}"> ${quantity}</span>
                        <div class="background-shadow" style="width: 99%; height: 99%; position: absolute; z-index: 4; top:1px; left:1px; border-radius: 10px; border: 2px solid #161616; background-image: radial-gradient(circle at 50% 150%,${rarity},rgba(51, 51, 51, 0.5));" class="">
                        </div>`;
                    
                    fragment.appendChild(li);
                }
            });
            
            processedCount += batch.length;
            
            // Update loading text with progress
            const loadingText = document.querySelector('.loading-text');
            if (loadingText) {
                const progress = Math.round((processedCount / limitedData.length) * 100);
                loadingText.textContent = `Loading Items... ${progress}%`;
            }
            
            // Reduced delay for faster loading
            if (i < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
        
        // Single DOM insertion for all items
        document.getElementById('skin-market-ul').appendChild(fragment);
        
        // Store items for sorting
        currentMarketItems = [...limitedData];
        
        // Hide loading spinner when done
        hideLoading();
        console.log(`✅ Successfully loaded ${processedCount} market items`);
        
    } catch (error) {
        console.error("Error loading market data:", error);
        hideLoading();
    }
}

// Track selected items and their total value
let selectedItems = [];
let totalSelectedValue = 0;

async function selecteditem(itemName) {
    let price = await fetchPrice(itemName)
    let priceValue = parseFloat(price.replace('$', '')) || 0;
    
    // Check if user has enough balance for total selected items
    if (!window.balanceManager || window.balanceManager.getUserBalance() < (totalSelectedValue + priceValue)) {
        errorMessage("Insufficient balance to select this item.");
        return;
    }
    
    let nameofitem = itemName
    
    if (nameofitem.length >= 15) {
        nameofitem =  nameofitem.slice(0, 10) + "...";
    }
    let template = `<li id="${itemName + '-selected'}" style="justify-content: space-between; border-radius: 5px; width: 90%; margin-top: 10px;  background-color: #282828;" class=" flex items-center flex-row miniwithdrawli flex-wrap">
                        <span class="item-name" style="margin-left: 5px; font-family: carving; color: white; font-size: 13px; margin-top: 3px;">${nameofitem}</span>
                        <span class="item-price" style="margin-left: 5px; font-family: carving; color: #4ECCA3; font-size: 13px; margin-top: 3px;">${price}</span>
                        <img class="x-button" src="imgs/x.png" style="z-index: 10; cursor:pointer; width: 25px; height: 25px; margin-left: 5px; float: right;" onclick="removeItem('${price}', '${itemName}')">
                    </li>`
    let oldquanity = document.getElementById(itemName).innerHTML
    let Sliced = oldquanity.slice(0, -1);
    let num = Number(Sliced)
    let newQuanity = num - 1
    if (newQuanity < 0) {
        errorMessage("Attempting to withdraw maximum amount of certain item.")
    } else {
        // Add to selected items tracking
        selectedItems.push({ name: itemName, price: priceValue });
        totalSelectedValue += priceValue;
        
        // Update the balance display to show remaining balance
        updateBalanceCounter();
        
        document.getElementById(itemName).innerHTML = newQuanity + "x"
        document.getElementById('selected-items-withdrawal-ul').insertAdjacentHTML("afterbegin", template);
    }
}

async function removeItem(price, itemName) {
    let priceValue = parseFloat(price.replace('$', '')) || 0;
    
    // Remove from selected items tracking
    selectedItems = selectedItems.filter(item => item.name !== itemName);
    totalSelectedValue -= priceValue;
    
    // Update the balance display to show remaining balance
    updateBalanceCounter();
    
    let oldquanity = document.getElementById(itemName).innerHTML
    let Sliced = oldquanity.slice(0, -1);
    let num = Number(Sliced)
    let newQuanity = num + 1
    document.getElementById(itemName).innerHTML = newQuanity + "x"
    document.getElementById(itemName + '-selected').remove()
}

// Update balance counter display
function updateBalanceCounter() {
    if (window.balanceManager) {
        const realBalance = window.balanceManager.getUserBalance();
        const remainingBalance = realBalance - totalSelectedValue;
        
        // Update the balance display in the withdraw section
        const balanceDisplay = document.querySelector('.balance-display');
        if (balanceDisplay) {
            balanceDisplay.textContent = `$${remainingBalance.toFixed(2)}`;
        }
    }
}

// Handle actual withdrawal
function withdrawItems() {
    if (selectedItems.length === 0) {
        errorMessage("No items selected for withdrawal.");
        return;
    }
    
    if (!window.balanceManager) {
        errorMessage("Balance manager not available.");
        return;
    }
    
    // Deduct the total from real balance only on actual withdrawal
    if (window.balanceManager.deductBalance(totalSelectedValue)) {
        // Clear selected items
        selectedItems = [];
        totalSelectedValue = 0;
        
        // Clear the selected items list
        document.getElementById('selected-items-withdrawal-ul').innerHTML = '';
        
        // Reset balance display to show real balance
        window.balanceManager.updateBalanceDisplay();
        
        // Success message
        alert("Items withdrawn successfully!");
    } else {
        errorMessage("Insufficient balance for withdrawal.");
    }
}

// Initialize loading when page loads (only once)
let marketDataLoaded = false;
let currentMarketItems = []; // Store current items for sorting
let currentSortType = 'default';

function initializeMarket() {
    if (marketDataLoaded) return;
    marketDataLoaded = true;
    
    // Clear any existing items first
    const marketUl = document.getElementById('skin-market-ul');
    if (marketUl) {
        marketUl.innerHTML = '';
    }
    
    loadMarketData();
}

document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure DOM is fully ready
    setTimeout(initializeMarket, 100);
});

// Fallback if DOMContentLoaded already fired
if (document.readyState !== 'loading') {
    // DOM is already ready
    setTimeout(initializeMarket, 100);
}

// Sorting functionality
function sortItems(sortType) {
    if (currentMarketItems.length === 0) return;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`sort-${sortType}`).classList.add('active');
    
    currentSortType = sortType;
    
    let sortedItems = [...currentMarketItems];
    
    if (sortType === 'price-low') {
        sortedItems.sort((a, b) => {
            const priceA = parseFloat(a.name.match(/\$([0-9.]+)/) ? a.name.match(/\$([0-9.]+)/)[1] : '0') || 0;
            const priceB = parseFloat(b.name.match(/\$([0-9.]+)/) ? b.name.match(/\$([0-9.]+)/)[1] : '0') || 0;
            return priceA - priceB;
        });
    } else if (sortType === 'price-high') {
        sortedItems.sort((a, b) => {
            const priceA = parseFloat(a.name.match(/\$([0-9.]+)/) ? a.name.match(/\$([0-9.]+)/)[1] : '0') || 0;
            const priceB = parseFloat(b.name.match(/\$([0-9.]+)/) ? b.name.match(/\$([0-9.]+)/)[1] : '0') || 0;
            return priceB - priceA;
        });
    }
    // default keeps original order
    
    // Clear and reload items
    const marketUl = document.getElementById('skin-market-ul');
    if (marketUl) {
        marketUl.innerHTML = '';
        loadSortedItems(sortedItems);
    }
}

// Load sorted items with price fetching
async function loadSortedItems(items) {
    showLoading();
    
    const batchSize = 50;
    const totalBatches = Math.ceil(items.length / batchSize);
    let processedCount = 0;
    
    for (let i = 0; i < totalBatches; i++) {
        const batch = items.slice(i * batchSize, (i + 1) * batchSize);
        
        const batchPromises = batch.map(async (item) => {
            try {
                const [price, img] = await Promise.all([
                    fetchPrice(item.name),
                    fetchIcon(item.name)
                ]);
                
                let quantity = item.quantity || 0;
                
                if (price === null || img === null) {
                    return null;
                }
                
                let formattedPrice = price;
                if (price && !price.toString().startsWith('$')) {
                    formattedPrice = `$${price}`;
                }
                
                let rarity = getItemRarity(item.rarity);
                
                return {
                    item,
                    price: formattedPrice,
                    img,
                    quantity,
                    rarity
                };
            } catch (error) {
                return null;
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Sort batch results by price if needed
        let sortedBatchResults = batchResults.filter(result => result !== null);
        
        if (currentSortType === 'price-low') {
            sortedBatchResults.sort((a, b) => {
                const priceA = parseFloat(a.price.replace('$', '')) || 0;
                const priceB = parseFloat(b.price.replace('$', '')) || 0;
                return priceA - priceB;
            });
        } else if (currentSortType === 'price-high') {
            sortedBatchResults.sort((a, b) => {
                const priceA = parseFloat(a.price.replace('$', '')) || 0;
                const priceB = parseFloat(b.price.replace('$', '')) || 0;
                return priceB - priceA;
            });
        }
        
        const htmlFragments = [];
        sortedBatchResults.forEach(result => {
            const { item, price, img, quantity, rarity } = result;
            const itemTemplate = `
            <li onclick="selecteditem('${item.name}')" style=" cursor: pointer; background-color: #111; border-radius: 10px;" class="relative depoli">
                <div class="flex items-center flex-col justify-center" style="width: 100%; height: 100%; z-index: 7;">
                    <img class="imgdropshadow" src="${img}" style=" width: 50px; height: 50px; z-index: 8;" onerror="this.src='imgs/default-item.png'">
                    <span style="text-align: center; font-size: 13px; z-index: 8; color: #ffffff; font-family: carving; margin-top: 7px;">${item.name}</span>
                    <span style="font-size: 13px; z-index: 8; color: #4ECCA3; font-family: carving; margin-top: 2px;">${price}</span>
                </div>
                <span class="absolute" style="color: #4ECCA3; top: 0; z-index: 10; margin-top: 10px; margin-left: 10px;" id="${item.name}"> ${quantity}</span>
                <div class="background-shadow" style="width: 99%; height: 99%; position: absolute; z-index: 4; top:1px; left:1px; border-radius: 10px; border: 2px solid #161616; background-image: radial-gradient(circle at 50% 150%,${rarity},rgba(51, 51, 51, 0.5));" class="">
                </div>
            </li>`;
            htmlFragments.push(itemTemplate);
        });
        
        if (htmlFragments.length > 0) {
            document.getElementById('skin-market-ul').insertAdjacentHTML("beforeend", htmlFragments.join(''));
        }
        
        processedCount += batch.length;
        
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            const progress = Math.round((processedCount / items.length) * 100);
            loadingText.textContent = `Sorting Items... ${progress}%`;
        }
        
        if (i < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    hideLoading();
}
        
