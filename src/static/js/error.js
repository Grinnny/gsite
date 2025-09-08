

async function errorMessage(errorMessage) {
    let errTemplate = `
                <div class="absolute" style="width: 100%; height: 100%">
                    <div class="relative errormessage" style="z-index: 11; float: right; margin-right: 20px; margin-top: 40%; width: 200px; height: auto; border-radius: 10px; border: 2px red solid; background-color: rgb(255, 60, 60);">
                        <span style="font-size: 20px; text-align: center; width: 100%; position: relative; display: block; color: white; font-family: carving">A Error Occured!!</span>
                        <span style="padding-left: 5px; padding-right: 5px; font-size: 12px; color: white; text-align: center; display: block; font-family: carving; margin-top: 5px">${errorMessage}</span>
                    </div>
                </div>`

    document.getElementById('body').insertAdjacentHTML("afterbegin", errTemplate);
    setTimeout(function() {
        let bodychildren = document.getElementById('body').children
        bodychildren[0].style.opacity = 0
  console.log("5 seconds have passed!");
}, 5000);
}