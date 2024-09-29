const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Adding stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
];

async function scrapLienDrive(page) {
    await page.goto("https://www.carrefour.fr/magasin/liste/market");


    const rejectButton = await page.waitForSelector('#onetrust-reject-all-handler');
    await rejectButton.click();

    const footer = await page.waitForSelector('#colophon');
    await footer.evaluate(el => el.scrollIntoView());

    const drivesTag = await page.$$('.card-store');
    let listLienDrives = [];
    for (let drive of drivesTag) {
        let lienDrive = await drive.evaluate(el => el.getAttribute('href'));
        lienDrive ='https://www.carrefour.fr'+lienDrive
        listLienDrives.push(lienDrive);
        console.log(lienDrive);
    }

    return listLienDrives;
}

async function scrapDrive(page, listLienDrives) {
    let listDrive = [];
    for (let lien of listLienDrives) {
        await page.goto(lien);
        try {
       
            const nomDriveElement = await page.$('#store-page > header > div > div > div.store-page-header__wrapper > div > h1');
            const nomDrive = await page.evaluate(element => element.textContent, nomDriveElement);
            console.log(nomDrive)

            const adresseDriveElement = await page.$('#data-store-info > div > div.store-page-main-info__wrapper.store-page-main-info__wrapper--narrow > div.store-page-main-info__block.store-page-main-info__block--main > div.store-page-invite.store-page-main-info__invite > ul > li:nth-child(1) > a > p');
            const adresseDrive = await page.evaluate(element => element.textContent, adresseDriveElement);
            console.log(adresseDrive)

           

            const dict_drive ={
                "nom_drive": nomDrive,
                'adresse': adresseDrive,
                "lien_drive": lien,
                
            }
            
            listDrive.push(dict_drive);

        } catch (error) {
            console.error('Error scraping drive:', error);
        }
    }
    //const df_drive = listDrive.filter(prod => prod !== null); // Filter out null values
    //fs.writeFileSync(`listDriveCarrefour.csv`, df_drive.map(obj => Object.values(obj).join(',')).join('\n'));

    return listDrive;
}

function findLastIndex(string, char) {
    const indices = [];
    for (let i = 0; i < string.length; i++) {
        if (string[i] === char) {
            indices.push(i);
        }
    }
    return indices[indices.length - 1];
}

function processDrive(drives) {
    let listDrives = [];
    for (let drive of drives) {
        const { adresse, nom_drive, lien_drive } = drive;
        const virgule = findLastIndex(adresse, ',');
        const department = adresse.slice(virgule - 5, virgule - 3);
        const city = adresse.slice(virgule - 5).replace(",", "");
        const reservedCharacter = ["!", "*", "'", "(", ")", ";", ":", "@", "&", "=", "+", "$", ",", "/", "?", "%", "#", "[", "]", " "];
        let nomDriveUrl = nom_drive;
        for (let character of reservedCharacter) {
            nomDriveUrl = nomDriveUrl.replace(new RegExp(`\\${character}`, 'g'), "_");
        }
        const dictDrive = {
            supermarket: "Carrefour",
            department: department,
            nom_drive: nom_drive,
            nom_driveUrl: nomDriveUrl,
            city: city.replace(/,/g, ""),
            adresse: adresse.replace(/,/g, ""),
            lien_drive: lien_drive
        };
        console.log(dictDrive);
        listDrives.push(dictDrive);
    }

    const csvContent = listDrives.map(d => `${d.supermarket},${d.department},${d.nom_drive},${d.nom_driveUrl},${d.city},${d.adresse},${d.lien_drive}`).join('\n');
    fs.writeFileSync('list_drives_carrefourMarket.csv', csvContent);
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-popup-blocking',
            '--start-maximized',
            '--disable-extensions',
            '--no-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    const page = await browser.newPage();

    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(userAgent);

    const listLienDrive = await scrapLienDrive(page);
    const drives = await scrapDrive(page, listLienDrive);
    processDrive(drives);

    await browser.close();
})();
