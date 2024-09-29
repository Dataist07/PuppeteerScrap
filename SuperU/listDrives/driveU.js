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
    await page.goto("https://www.magasins-u.com/annuaire-magasin.m35894");

    const rejectButton = await page.waitForSelector('#popin_tc_privacy_button_2');
    await rejectButton.click();

    const drivesTag = await page.$$('.u-list-magasin__link');
    let listLienDrives = [];
    for (let drive of drivesTag) {
        let lienDrive = await drive.evaluate(el => el.getAttribute('href'));
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
       
            const nomDriveElement = await page.$('.h1');
            const nomDrive = await page.evaluate(element => element.textContent, nomDriveElement);

            const adresseDriveElement = await page.$('.b-md--sm');
            const adresseDrive = await page.evaluate(element => element.textContent, adresseDriveElement);

            const lienDriveElement = await page.$('.u-btn--primary');
            const lienDrive = await page.evaluate(element => element.getAttribute('href'), lienDriveElement);

            const lienCoordElement = await page.$('.u-btn--dark-secondary');
            const longitude = await page.evaluate(element => element.getAttribute('data-store-longitude'), lienCoordElement);
            const latitude = await page.evaluate(element => element.getAttribute('data-store-latitude'), lienCoordElement);
       
            const dict_drive ={
                "nom_drive": nomDrive,
                'adresse': adresseDrive.replace(/  /g, "").replace(/\n/g, ","),
                'lien_drive':lienDrive,
                "longitude": longitude,
                "latitude": latitude,
            }
            
            listDrive.push(dict_drive);
            console.log(dict_drive)

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
    return indices[indices.length - 3];
}

function processDrive(drives) {
    let listDrives = [];
    let i = 0
    for (let drive of drives) {
        const { adresse, nom_drive, lien_drive,longitude,latitude } = drive;

        if (lien_drive !== null) {
            const virgule = findLastIndex(string=adresse,char=',');
            const department = adresse.slice(virgule +1, virgule + 3);
            const city = adresse.slice(virgule +1).replace(",", "");

            const reservedCharacter = ["!", "*", "'", "(", ")", ";", ":", "@", "&", "=", "+", "$", ",", "/", "?", "%", "#", "[", "]", " "];
            let nomDriveUrl = nom_drive.replace(/  /g, " ");
            for (let character of reservedCharacter) {
                nomDriveUrl = nomDriveUrl.replace(new RegExp(`\\${character}`, 'g'), "_");
            }

            const dictDrive = {
                "index": i + 1,
                "supermarket": "U",
                "department": department,
                "nom_drive": nom_drive.replace(/  /g, " "),
                "nom_driveUrl": nomDriveUrl,
                "city": city.replace(/,/g, ""),
                "adresse": adresse.replace(/,/g, ""),
                "latitude": latitude,
                "longitude": longitude,
                "lien_drive": lien_drive,
            };

            console.log(dictDrive);
            listDrives.push(dictDrive);
            i++;
        }
    }

    const csvContent = listDrives.map(d => `${d.index},${d.supermarket},${d.department},${d.nom_drive},${d.nom_driveUrl},${d.city},${d.adresse},${d.latitude},${d.longitude},${d.lien_drive}`).join('\n');
    fs.writeFileSync('list_drives_U.csv', csvContent);
}

(async () => {
    puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());
    
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
