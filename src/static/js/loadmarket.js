

async function fetchPrice(itemName) {
    const response = await fetch(window.location.origin+`/requestItemPrice?itemname=${itemName}`, {
        method: "GET"
    })
    if (!response.ok) {
        return null
    }
    const res =  await response.json();
    const price = await res.itemPrice;
    return price
}

async function fetchIcon(itemName) {
    let origin = window.location.origin;
    const response = await fetch(origin+`/requestItemIcon?itemname=${itemName}`, {
        method: "GET"
    })
    if (!response.ok) {
        throw new Error('error while fetching')
    }
    const res = await response.json();
    const src = res.iconSrc;
    return src;
}

async function getItemRarity(rarity) {
    const rarityrgb = {

            legendary: "rgba(251, 255, 0, 0.2)",
            mythical: "rgba(255, 0, 0, 0.2)",
            epic: "rgba(119, 0, 255, 0.2)",
            rare: "rgba(0, 132, 255, 0.2)",
            uncommon: "rgba(0, 255, 136, 0.2)",
            common: "rgba(154, 206, 255, 0.2)"
            
        }

        return rarityrgb[rarity]



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
async function loadMarketData() {
    let jsonRes = await fetch(window.location.origin + "/json/marketinfo.json")
    const jsonData = await jsonRes.json()

    for (const item of jsonData) {
        let price = await fetchPrice(item.name)
        let img = await fetchIcon(item.name)
        let quantity = await item.quantity

        let rarity = await getItemRarity(item.rarity)
        const itemTemplate = `
        <li onclick="selecteditem('${item.name}')" style=" cursor: pointer; background-color: #111; border-radius: 10px;" class="relative depoli">
                                
            <div class="flex items-center flex-col justify-center" style="width: 100%; height: 100%; z-index: 7;">
                <img class="imgdropshadow" src="${img}" style=" width: 50px; height: 50px; z-index: 8;">
                <span style="text-align: center; font-size: 13px; z-index: 8; color: #ffffff; font-family: carving; margin-top: 7px;">${item.name}</span>
                <span style="font-size: 13px; z-index: 8; color: #4ECCA3; font-family: carving; margin-top: 2px;">${price}</span>
            </div>
            <span class="absolute" style="color: #4ECCA3; top: 0; z-index: 10; margin-top: 10px; margin-left: 10px;" id="${item.name}"> ${quantity}</span>
            <div class="background-shadow" style="width: 99%; height: 99%; position: absolute; z-index: 4; top:1px; left:1px; border-radius: 10px; border: 2px solid #161616; background-image: radial-gradient(circle at 50% 150%,${rarity},rgba(51, 51, 51, 0.5));" class="">
            </div>
        </li>`
        document.getElementById('skin-market-ul').insertAdjacentHTML("afterbegin", itemTemplate);
        if (price = null) {
            console.log("failed to fetch")
        }
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

loadMarketData()
        
