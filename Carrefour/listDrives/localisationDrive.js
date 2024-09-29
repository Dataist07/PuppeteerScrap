

const puppeteer = require('puppeteer-extra')
const fs = require('fs');



//////////////////////////////////////////////////////////////////////////////////////////////////////
async function getLocalisation(page,df, listDrives = []) {
    const columnNames = 'index,supermarket,department,nom_drive,nom_driveUrl,city,adresse,latitude,longitude,lien_drive,lien_coord';
    await page.goto('https://torop.net/coordonnees-gps.php');
    await new Promise(r => setTimeout(r, 10000))

    for (let i = 0; i < df.length; i++) {
        const adresse = df[i][5];
        const department = df[i][1];
        const nomDrive = df[i][2];
        const city = df[i][4];
        console.log(adresse)

        
         // Wait for the input selector to appear
        const inputNomDrive = '#address'; // Replace with the actual input field selector
        await page.waitForSelector(inputNomDrive);

        // Focus on the input field
        await page.focus(inputNomDrive);

        // Clear the input field by selecting all text and deleting it
        await page.evaluate((selector) => {
            const input = document.querySelector(selector);
            input.select();
            document.execCommand('delete');
        }, inputNomDrive);

        // Optionally, fill the input field with new text
        await page.type(inputNomDrive, adresse); // Replace with the text you want to input
  
        await page.click('#geocodeAddress');

        await new Promise(r => setTimeout(r, 2000))


        
        // Longitude
        const inputLongitude = '#lng'; // Replace with the actual input field selector
        await page.waitForSelector(inputLongitude);

        // Get the value of the input field
        const longitude = await page.evaluate((selector) => {
            return document.querySelector(selector).value;
        }, inputLongitude);

        console.log(`longitude: ${longitude}`);

        // Lattitude
        const inputLattitude = '#lat'; // Replace with the actual input field selector
        await page.waitForSelector(inputLattitude);

        // Get the value of the input field
        const latitude = await page.evaluate((selector) => {
            return document.querySelector(selector).value;
        }, inputLattitude);

        console.log(`latitude: ${latitude}`);

        const dictDrive = {
            "index": i + 1,
            "supermarket": "CarrefourMarket",
            "department": department,
            "nom_drive": nomDrive,
            "nom_driveUrl": nomDrive.replace(/ /g, "_"),
            "city": city.replace(/,/g, ""),
            "adresse": adresse.replace(/  /g, "").replace(/,/g, ""),
            "latitude": latitude,
            "longitude": longitude,
            "lien_drive": df[i][6],
        
        };
        listDrives.push(dictDrive);
           
        
    }

    const csvContent = listDrives.map(d => `${d.index},${d.supermarket},${d.department},${d.nom_drive},${d.nom_driveUrl},${d.city},${d.adresse},${d.latitude},${d.longitude},${d.lien_drive}`).join('\n');
    fs.writeFileSync('list_drives_carrefourMarket_processed.csv', csvContent);
};


async function mainLoop(browser) {
    while (true) {
        try {
            const df = fs.readFileSync('list_drives_carrefourMarket.csv', 'utf-8')
            .split('\n')
            .map(line => {
                // Use regular expression to split the line by comma, but not if it's inside quotes
                return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
            });
        

            const page = await browser.newPage();
        
            await getLocalisation(page,df)
            break; // Exit the loop if functionMain succeeds
        } catch (error) {
            console.error(`An error occurred: ${error.message}`);
            console.log("Restarting functionMain");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for a short duration before retrying (1 second)
        }
    }
}

(async () => {

    //puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: false,

    }); // Change to true for headless browsing

    // Call the mainLoop function to start the loop
    await mainLoop(browser);
})();
