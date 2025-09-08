async function testapi(itemname) {
    let baseEndpoint = "https://api.sih.market/api/v1/get-min-item"
    let fdas = await fetch(baseEndpoint, {
        item: "Big Grin",
        minified: false,
        appId: 252490
    })

    const res = await fdas.json()
    console.log(res)
}

testapi()