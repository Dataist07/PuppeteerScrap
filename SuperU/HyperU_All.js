

const puppeteer = require('puppeteer-extra')
const fs = require('fs');



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function autoScroll(page, posMax){
    await page.evaluate(async (posMax) => {
        await new Promise((resolve) => {
            var totalHeight = 0;
            var distance = 800;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                
                // stop scrolling if reached the end or the maximum number of scrolls
                if(totalHeight >= scrollHeight - window.innerHeight || totalHeight >= posMax){
                    
                    clearInterval(timer);
                    resolve();
                }
                
            }, 1000);
            
        });
    }, posMax);  // pass posMax to the function
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function page_produits(page, rayonPrincipal,rayonSecondaire, list_page_produits = []) {
    await page.waitForSelector('.plp-title');
    const body = await page.$('.search-result-content');

    try {
        const produits_tag = await body.$$('.grid-tile');
        
        for (const produit of produits_tag) {
            try {

                const nom_produitTag = await produit.evaluate(el => el.querySelector('.product-name').textContent)

                const prix_produit = await produit.evaluate(el => el.querySelector('.sale-price').textContent);

                const attribut_produit = await produit.evaluate(el => el.querySelector('.unit-info-container').textContent);


                const lien_image = await produit.$('.primary-image');
                const lien_image_src = await (await lien_image.getProperty("src")).jsonValue();

                const dict_produit = {
                    'rayon_principal': rayonPrincipal,
                    'rayon_secondaire': rayonSecondaire,
                    'nom_produit': nom_produitTag.replace(/\n/g, " ").replace(/  /g, ""),
                    'prix_produit': prix_produit.replace(/\n/g, "").replace(/  /g, ""),
                    'attribut_produit': attribut_produit.replace(/\n/g, "").replace(/  /g, ""),
                    'lien_image': lien_image_src
                };
                //console.log(dict_produit)
                list_page_produits.push(dict_produit);
            } catch (error) {}
        }
    } catch (error) {}
    
    return list_page_produits;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function search_produits(page, df_rayons, nom_drive, department, city, today,year, month) {
    const list_produits = [];
    
    
    for (const rayon of df_rayons)  {
     
        const rayonPrincipal = rayon.rayon_principal;
        const rayonSecondaire = rayon.rayon_secondaire;
        const lien_rayon = rayon.lien_rayon_secondaire;
        const rayonPeuUtile = ['Cave à vins', 'Champagnes et effervescents', 'Soins et puériculture', 'Maquillage', 
            'Santé & Parapharmacie', 'Accessoires ménagers','Chiens','Chats','Autres animaux'];
        
        const posMax = rayonSecondaire in rayonPeuUtile ? 10000 : 60000;

        console.log(rayonSecondaire);
        await page.goto(lien_rayon);  
        
        // Scroll down to the end of page
        await autoScroll(page,posMax);
        //await new Promise(r => setTimeout(r, 1))

        // Scrap products
        const list_page_produits = await page_produits(page, rayonPrincipal,rayonSecondaire);
        list_produits.push(...list_page_produits);
                
    };

    const df_produits = list_produits.filter(prod => prod !== null); // Filter out null values
    const newpath = `../../Data_base/${year}/${month}/${department}/${city}/${nom_drive}/${today}/`;

    if (!fs.existsSync(newpath)) {
        fs.mkdirSync(newpath, { recursive: true });
    }

    fs.writeFileSync(`${newpath}/HyperU_produits.csv`, df_produits.map(obj => Object.values(obj).join(',')).join('\n'));
    
    return df_produits;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function findSecIndex(string, char) {
    const indices = [];
    for (let i = 0; i < string.length; i++) {
        if (string[i] === char) {
            indices.push(i);
        }
    }
    return indices[indices.length - 2];
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Function to clean and process product data
async function dataPrixClean(df_produits, nom_drive, department, city, nom_driveUrl, today, year, month) {
    
    const list_produits = [];
    for (let i = 0; i < df_produits.length; i++) {
        const prix = df_produits[i]['prix_produit'];
        const prixrat = df_produits[i]['attribut_produit'];
        const lien_image = df_produits[i]['lien_image'];
        

        let prix_trans = 0;
        try {
            prix_trans = parseFloat(prix.slice(0, -2).replace(",", "."));
        } catch (error) {
            prix_trans = 0;
        }

        const index_slash = prixrat.lastIndexOf('/');
        let prix_rat_trans;
        let unite;
        prix_rat_trans = parseFloat(prixrat.slice(0, index_slash - 2).replace(",", "."));
        unite = prixrat.slice(index_slash, index_slash+3);

        const avDerEspace = findSecIndex(string=lien_image, char='%20');
        const derEspace = lien_image.lastIndexOf('%20')
        const lien_imageTrans=lien_image.slice(avDerEspace, derEspace);

        let nom_produit = df_produits[i]['nom_produit'].toString();
        const dict_produit = {
            'supermarket': "HyperU",
            'nom_drive': nom_drive.replace(/,/g, ""),
            'nom_driveUrl': nom_driveUrl.replace(/,/g, ""),
            'rayon_principal': df_produits[i]['rayon_principal'].replace(/,/g, ""),
            'rayon_secondaire': df_produits[i]['rayon_secondaire'].replace(/,/g, ""),
            'nom_produit': nom_produit.replace(/,/g, " ").replace(/Œ/g, 'Oe').replace(/œ/g, "oe").replace(/  /g, " "),
            'prix_produit': prix_trans,
            'prix_ratio': prix_rat_trans,
            'unite': unite.replace(/,/g, ""),
            'lien_image': lien_imageTrans.replace(/,/g, ""),
        };
        console.log(dict_produit)

        list_produits.push(dict_produit);
    }

    // Processing DataFrame
    const df_produits_clean = list_produits.filter(prod => prod.prix_produit !== 0 && prod.prix_ratio !== 0 && prod.lien_image !== '');
    const uniqueProds = new Set(df_produits_clean.map(JSON.stringify));
    const uniqueData = Array.from(uniqueProds).map(JSON.parse);

    // Convert the processed data to CSV and save
    

    const filePath = `../../Data_base/${year}/${month}/${department}/${city}/${nom_drive}/${today}/HyperU_produits.csv`;
    
    fs.writeFileSync(filePath, ''); // Clear the file
    fs.appendFileSync(filePath, 'supermarket,nom_drive,nom_driveUrl,rayon_principal,rayon_secondaire,nom_produit,prix_produit,prix_ratio,unite,lien_image\n');

    uniqueData.forEach(item => {
        fs.appendFileSync(filePath, `${Object.values(item).join(',')}\n`);
    });
}

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
        fs.writeFileSync('cookies.txt', cookieString);
    }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function scrapAll(today, year,month,page) {

    // Choisir les départements à scrap
    const departement_scrap = [
        ...Array.from({ length: 100 }, (_, i) => String(i).padStart(2, "0"))
      ];
    const df = fs.readFileSync('listDrives/list_drives_U.csv', 'utf-8')
        .split('\n')
        .map(line => line.split(','))
        .filter(arr => departement_scrap.includes(arr[2]));

 
    let df_drivesScraped;
    try {
        df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_HyperUScraped.csv`, 'utf-8')
            .split('\n')
            .map(line => line.split(','))
            .map(arr => ({
                id: arr[0],
                supermarket: arr[1],
                department: arr[2],
                nom_drive: arr[3],
                nom_driveUrl: arr[4],
                city: arr[5],
                adresse: arr[6],
                latitude: arr[7],
                longitude: arr[8],
                lien_drive: arr[9],
                date_scraped: arr[10]
            }));
    } catch {
        df_drivesScraped = [];
    }
    
    const indexLastDriveScraped = df_drivesScraped.length > 0 ? parseInt(df_drivesScraped[df_drivesScraped.length - 1].id) : -1;
   
    for (let i = 0; i < df.length; i++) {
        const lien_drive = df[i][9];
        const indexActual = df[i][0];
        
        if (indexLastDriveScraped < indexActual) {
            const nom_drive = df[i][3];
            const department = df[i][2];
            const city = df[i][5];
            const nom_driveUrl = df[i][4];

            if (nom_drive.includes("Hyper U")) {
                console.log(`Scraping ${nom_drive}`);
        
                await addCookiesFromFile(page, 'cookies.txt');
                await page.goto(lien_drive);
            

                // Scrap rayons
                let df_rayons = fs.readFileSync(`U_rayons.csv`, 'utf-8')
                .split('\n')
                .map(line => {
                    // Use regular expression to split the line by comma, but not if it's inside quotes
                    return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
                })
                .map(arr => ({
                    rayon_principal: arr[0],            
                    rayon_secondaire: arr[1],
                    lien_rayon_secondaire: arr[2],
                }));

                // Scrap tous les produits
                df_produits = await search_produits(page, df_rayons, nom_drive, department, city, today, year, month);

                // Clean data
                await dataPrixClean(df_produits, nom_drive, department, city, nom_driveUrl, today, year, month);

                // Ajout dans les drives scraped
                const dict_drive = {
                    id: indexActual,
                    supermarket: "HyperU",
                    department: department,
                    nom_drive: nom_drive,
                    nom_driveUrl: nom_driveUrl,
                    city: city,
                    adresse: df[i][6],
                    latitude: df[i][7],
                    longitude: df[i][8],
                    lien_drive: lien_drive,
                    date_scraped: today
                };
                df_drivesScraped.push(dict_drive);

                const newpath = `../../Data_base/${year}/${month}/drivesScraped`;
                if (!fs.existsSync(newpath)) {
                    fs.mkdirSync(newpath, { recursive: true });
                }
                fs.writeFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_HyperUScraped.csv`, df_drivesScraped.map(obj => Object.values(obj).join(',')).join('\n'));
                console.log(`Scraping ${nom_drive} terminé`);
                console.log("--------------------------------------------------------------------------------------------------------------------");
            }
        }    
    }
}

async function mainLoop(browser) {
    while (true) {
        try {
            const date= new Date()

            const year = date.getFullYear();
            const month = "4";
            const today = new Date().toISOString().slice(0, 10);
   
            const page = await browser.newPage();
        
            await scrapAll(today, year,month,page).then(() => {
                console.log('Scraping completed successfully.');
                let df_drivesScraped;
                df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_HyperUScraped.csv`, 'utf-8')
                        .split('\n')
                        .map(line => line.split(','))
                        .map(arr => ({
                            id: arr[0],
                            supermarket: arr[1],
                            department: arr[2],
                            nom_drive: arr[3],
                            nom_driveUrl: arr[4],
                            city: arr[5],
                            adresse: arr[6],
                            latitude: arr[7],
                            longitude: arr[8],
                            lien_drive: arr[9],
                            date_scraped: arr[10]
                        }));

                
                const filePath = `../../Data_base/${year}/${month}/drivesScraped/list_drives_HyperUScraped.csv`;
                
                fs.writeFileSync(filePath, ''); // Clear the file
                fs.appendFileSync(filePath, 'id,supermarket,department,nom_drive,nom_driveUrl,city,adresse,latitude,longitude,lien_drive,date_scraped\n');

                df_drivesScraped.forEach(item => {
                    fs.appendFileSync(filePath, `${Object.values(item).join(',')}\n`);
                });

            })
            break; // Exit the loop if functionMain succeeds
        } catch (error) {
            console.error(`An error occurred: ${error.message}`);
            console.log("Restarting functionMain");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for a short duration before retrying (1 second)
        }
    }
}

(async () => {

    puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: false,

    }); // Change to true for headless browsing

    // Call the mainLoop function to start the loop
    await mainLoop(browser);
})();
