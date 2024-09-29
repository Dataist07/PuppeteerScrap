

const puppeteer = require('puppeteer-extra')
const fs = require('fs');

async function searchLienDrives(page,lienRegion) {
    
    // Array to keep the rayons
    let listLienDrives = [];
    await page.goto(lienRegion);
   
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });   
    await page.waitForSelector('.ulWPAD004_DrivePictoDefault');
    const driveTags = await page.$$('.ulWPAD004_DrivePictoDefault');

    for (drive of driveTags) {
        const lienDrive = await drive.evaluate(el => el.querySelector('a').getAttribute('href'));
        //console.log(lienDrive)
        listLienDrives.push(lienDrive);
    }
    
    return listLienDrives;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function searchDrives(page,listLienTotal) {

    // Array to keep the rayons
    let listDrives = [];
    for (lien of listLienTotal)  {
        await page.goto(lien);
       
        await page.waitForSelector('.popinPRPL-details-nom');
        const nomDriveElement = await page.$('.popinPRPL-details-nom');
        const nomDrive = await page.evaluate(element => element.textContent, nomDriveElement);

        const cityElement = await page.$('.popinPRPL-details-en-tete-adresse-titre-addresseDetail-codepostal');
        const city= await page.evaluate(element => element.textContent, cityElement);

        const adressElement = await page.$('.popinPRPL-details-en-tete-adresse-titre-addresseDetail-adresse1');
        const adress = await page.evaluate(element => element.textContent, adressElement);
        const adress_drive= adress + " " + city

        const lienElement = await page.$('.popinPRPL-details-informations');
        const lien_drive = await page.evaluate(element => element.querySelector('a').getAttribute('data-url'), lienElement);

        const lienCoordElement = await page.$('.popinPRPL-details-en-tete-adresse-titre-addresseDetail');
        const lien_coord = await page.evaluate(element => element.querySelector('a').getAttribute('href'), lienCoordElement);

        const dict_drive ={
            "nom_drive": nomDrive,
            "city": city,
            'adresse': adress_drive,
            "lien_drive": lien_drive,
            'lien_coord':lien_coord
        }
        
        listDrives.push(dict_drive);
        getcookies(page)
        await new Promise(r => setTimeout(r, 1500))
    
    }
    return listDrives;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////
async function processDrives(df, listDrives = []) {
    const columnNames = 'index,supermarket,department,nom_drive,nom_driveUrl,city,adresse,latitude,longitude,lien_drive,lien_coord';
    
    for (let i = 0; i < df.length; i++) {
        const city = df[i]['city'];
        const department = city.slice(1, 3);
        console.log(city)

        let nomDrive = df[i]['nom_drive'].replace("/", "").replace(/,/g, "").replace(/E.Leclerc DRIVE/g, "Leclerc");

        const adresse = df[i]['adresse'];

        const lienCoord = df[i]['lien_coord'];
        const equal = lienCoord.lastIndexOf('=');
        const comma = lienCoord.lastIndexOf(',');

        const latitude = lienCoord.substring(equal + 1, comma);
        const longitude = lienCoord.substring(comma + 1);

        if (!nomDrive.includes('Retrait au camion')) {
            const dictDrive = {
                "index": i + 1,
                "supermarket": "Leclerc",
                "department": department,
                "nom_drive": nomDrive,
                "nom_driveUrl": nomDrive.replace(/ /g, "_"),
                "city": city.replace(/,/g, ""),
                "adresse": adresse.replace(/  /g, "").replace(/,/g, ""),
                "latitude": latitude,
                "longitude": longitude,
                "lien_drive": df[i]['lien_drive'],
                "lien_coord": lienCoord
            };
            listDrives.push(dictDrive);
           
        }
    }

    const dfDrives = listDrives.reduce((acc, cur) => {
        if (!acc.some(obj => obj.nom_drive === cur.nom_drive && obj.lien_drive === cur.lien_drive && obj.lien_coord === cur.lien_coord)) {
            acc.push(cur);
        }
        return acc;
    }, []);

    // Convert JSON to CSV format
    const csvData = `${columnNames}\n${dfDrives.map(obj => Object.values(obj).join(',')).join('\n')}`;

    // Write CSV data to file
    fs.writeFileSync("list_drives_leclercPup.csv", csvData);
    console.log(dfDrives);
};






////////////////////////////////////////////////////////////////////////////////////////////////////
async function addCookiesFromFile(page, filePath) {
    try {
        const cookies = fs.readFileSync(filePath, 'utf-8')
            .split('\n')
            .map(line => line.split('\t'));
        for (const cookie of cookies) {
            if (cookie.length === 7) { // Ensure it's a valid cookie line
                await page.setCookie({
                    name: cookie[5],
                    value: cookie[6],
                    domain: cookie[0],
                    path: cookie[2],
                    expires: parseInt(cookie[4]),
                    httpOnly: cookie[3] === 'TRUE',
                    secure: cookie[1] === 'TRUE',
                    sameSite: 'Lax' // You can set it according to your needs
                });
            }
        }
        console.log('Cookies added successfully!');
    } catch (error) {
        console.error('Error adding cookies:', error);
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getcookies(page) {
    // Extract the DataDome cookie value
    const cookies = await page.cookies();
    const datadomeCookie = cookies.find(cookie => cookie.name === 'datadome');

    // Write the cookie value to a text file
    if (datadomeCookie) {
        const cookieString = `.leclercdrive.fr\tTRUE\t/\tTRUE\t${datadomeCookie.expires}\tdatadome\t${datadomeCookie.value}`;
        fs.writeFileSync('../cookies.txt', cookieString);
    }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function scrapAll(page) {
    
    let listeRegions = ['https://www.leclercdrive.fr/region-auvergne-rhone-alpes/','https://www.leclercdrive.fr/region-bourgogne-franche-comte/',
            'https://www.leclercdrive.fr/region-bretagne/','https://www.leclercdrive.fr/region-centre-val-de-loire/',
            'https://www.leclercdrive.fr/region-corse/','https://www.leclercdrive.fr/region-grand-est/','https://www.leclercdrive.fr/region-hauts-de-france/',
            'https://www.leclercdrive.fr/region-ile-de-france/','https://www.leclercdrive.fr/region-normandie/','https://www.leclercdrive.fr/region-nouvelle-aquitaine/',
            'https://www.leclercdrive.fr/region-occitanie-pyrenees-mediterranee/','https://www.leclercdrive.fr/region-pays-de-la-loire/','https://www.leclercdrive.fr/region-provence-alpes-cote-dazur/'
            ]

    let listLienTotal=[]
    await addCookiesFromFile(page, '../cookies.txt');

    for (const lienRegion of listeRegions)  {
        let listLienDrives = await searchLienDrives(page,lienRegion)
        listLienTotal.push(...listLienDrives);
    }
    //console.log(listLienTotal.length)
 
    // Convert the array to a Set to remove duplicates, then convert it back to an array
    listLienTotal = [...new Set(listLienTotal)];

    const df = await searchDrives(page,listLienTotal)
    await processDrives(df)
   
    
}

async function mainLoop(browser) {
    while (true) {
        try {
            
            const page = await browser.newPage();
        
            await scrapAll(page)
            break; // Exit the loop if functionMain succeeds
        } catch (error) {
            console.error(`An error occurred: ${error.message}`);
            console.log("Restarting functionMain");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for a short duration before retrying (1 second)
        }
    }
}

(async () => {
    const pathExtension ='../../Get-cookies-txt-LOCALLY';
    puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: false,
        args: [
            `--disable-extensions-except=${pathExtension}`, 
            `--load-extension=${pathExtension}`,
            '--enable-automation'
        ]
    }); // Change to true for headless browsing

    // Call the mainLoop function to start the loop
    await mainLoop(browser);
})();
