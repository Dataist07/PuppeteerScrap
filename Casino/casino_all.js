

const puppeteer = require('puppeteer-extra')
const fs = require('fs');

async function searchRayons(page) {

    // Array to keep the rayons
    const listRayons = [];
    await page.waitForSelector('.open-burger-left');
    const rayonsHandles = await page.$$('.burger-menu__content--list > .done');
    
    for (const rayonshandle of rayonsHandles) {
        try {
            const rayonPrincipal = await rayonshandle.evaluate(el => el.querySelector('div > div > div').textContent)
            // do whatever you want with the data
            const rayonsSecondHandles = await rayonshandle.$$('.done-second-content--container-header');
            
            for (const rayonsSecondHandle of rayonsSecondHandles) {
                const rayonsSecond = await rayonsSecondHandle.evaluate(el => el.querySelector('div.done-second-content--container-header__title').textContent);
                const lienSecondRayons = await rayonsSecondHandle.evaluate( element => element.querySelector('div.done-second-content--container-header__link > a').getAttribute('href'));
    
                const dictRayons = {
                    'rayon_principal': rayonPrincipal,
                    'rayon_secondaire': rayonsSecond,
                    'lien_rayon_secondaire': 'https://www.casino.fr/' + lienSecondRayons,
                };
                listRayons.push(dictRayons);
                //console.log(dictRayons)
            }
        } catch (error) {
            console.error(`pas de first title`);
        }
    }
    
    // Array of rayons to keep
    const listRayonsKeep = [
        "Fruits et légumes",
        "Produits Bio",
        "Viandes et poissons",
        "Pains et pâtisserie",
        "Produits laitiers",
        "Charcuterie traiteur",
        "Surgelés",
        "Épicerie salée",
        "Épicerie sucrée",
        "Bien être et nutrition",
        "Boissons",
        "Univers de bébé",
        "Hygiène et beauté",
        "Entretien nettoyage",
        "Animalerie"
    ];

    // Convert data to DataFrame equivalent in JavaScript
    const dfRayons = listRayons.filter(rayon => listRayonsKeep.includes(rayon.rayon_principal));
    
    // Remove duplicates
    const uniqueRayons = Array.from(new Set(dfRayons.map(a => a.rayon_secondaire)))
        .map(rayon_secondaire => {
            return dfRayons.find(a => a.rayon_secondaire === rayon_secondaire);
        });

    // Drop specific rayons
    const filteredRayons = uniqueRayons.filter(rayon => !(rayon.rayon_principal === 'Entretien nettoyage' && rayon.rayon_secondaire === 'Désodorisants et insecticides'));
    
    // Write to CSV
    const csvContent = filteredRayons.map(rayon => `"${rayon.rayon_principal}","${rayon.rayon_secondaire}",${rayon.lien_rayon_secondaire}`).join('\n');
    fs.writeFileSync('Casino_rayons.csv', csvContent);
    
    return filteredRayons;
}

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
                
            }, 500);
            
        });
    }, posMax);  // pass posMax to the function
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function page_produits(page, rayonPrincipal,rayonSecondaire, list_page_produits = []) {
    await page.waitForSelector('.lazyload');
    const body = await page.$('.lazyload');
    const produits_tag = await body.$$('li');

    for (const produit of produits_tag) {
        try {
                        
        
            const nom_produitTag = await produit.$('section > div.product-item__bottom > a');
            const nom_produit = await (await nom_produitTag.getProperty("title")).jsonValue();

            const prix_produit = await produit.evaluate(el => el.querySelector('.product-item__offer-price').textContent);
            const attribut_produit = await produit.evaluate(el => el.querySelector('.product-item__conditioning').textContent);

            const lien_image = await produit.$('section > div.product-item__top > a > img');
            const lien_image_src = await (await lien_image.getProperty("src")).jsonValue();

            const dict_produit = {
                'rayon_principal': rayonPrincipal,
                'rayon_secondaire': rayonSecondaire,
                'nom_produit': nom_produit,
                'prix_produit': prix_produit,
                'attribut_produit': attribut_produit.replace(/\n/g, "").replace(/\t/g, ""),
                'lien_image': lien_image_src
            };
            //console.log(dict_produit)
            list_page_produits.push(dict_produit);
        } catch (error) {
            
        }
    }
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

    fs.writeFileSync(`${newpath}/Casino_produits.csv`, df_produits.map(obj => Object.values(obj).join(',')).join('\n'));
    
    return df_produits;
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
            prix_trans = parseFloat(prix.slice(0, -1).replace(",", "."));
        } catch (error) {
            prix_trans = 0;
        }

        const index_slash = prixrat.lastIndexOf('/');
        const parenthese = prixrat.lastIndexOf('(');

        let prix_rat_trans;
        let unite;
        if (index_slash == -1 || parenthese == -1) {
            prix_rat_trans = prix_trans;
            unite = prixrat == " " ? "/unité" : prixrat;

            if (unite[0] == "x") {
                try {
                    const nbrUnite = parseFloat(unite.slice(1));
                    prix_rat_trans = parseFloat((prix_rat_trans / nbrUnite).toFixed(2));
                    unite = "/unite";
                } catch (error) {
                    // Do nothing
                }
            }
        } else {
            prix_rat_trans = parseFloat(prixrat.slice(parenthese + 1, index_slash - 1).replace(",", "."));
            unite = prixrat.slice(index_slash, -1);
        }

        let nom_produit = df_produits[i]['nom_produit'].toString();
        const dict_produit = {
            'supermarket': "Casino",
            'nom_drive': nom_drive.replace(/,/g, ""),
            'nom_driveUrl': nom_driveUrl.replace(/,/g, ""),
            'rayon_principal': df_produits[i]['rayon_principal'].replace(/,/g, ""),
            'rayon_secondaire': df_produits[i]['rayon_secondaire'].replace(/,/g, ""),
            'nom_produit': nom_produit.replace(/,/g, "").replace(/Œ/g, 'Oe').replace(/œ/g, "oe"),
            'prix_produit': prix_trans,
            'prix_ratio': prix_rat_trans,
            'unite': unite.replace(/,/g, ""),
            'lien_image': lien_image.replace(/,/g, ""),
        };
        //console.log(dict_produit)

        list_produits.push(dict_produit);
    }

    // Processing DataFrame
    const df_produits_clean = list_produits.filter(prod => prod.prix_produit !== 0 && prod.prix_ratio !== 0 && prod.lien_image !== '');
    const uniqueProds = new Set(df_produits_clean.map(JSON.stringify));
    const uniqueData = Array.from(uniqueProds).map(JSON.parse);

    // Convert the processed data to CSV and save
    

    const filePath = `../../Data_base/${year}/${month}/${department}/${city}/${nom_drive}/${today}/Casino_produits.csv`;
    
    fs.writeFileSync(filePath, ''); // Clear the file
    fs.appendFileSync(filePath, 'supermarket,nom_drive,nom_driveUrl,rayon_principal,rayon_secondaire,nom_produit,prix_produit,prix_ratio,unite,lien_image\n');

    uniqueData.forEach(item => {
        fs.appendFileSync(filePath, `${Object.values(item).join(',')}\n`);
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function scrapAll(today, year,month,page) {
    
   

    // Choisir les départements à scrap
    const departement_scrap = ["75", "13", "69", "31", "06", "44", "34", "67", "33", "59", "82", "77", "78", "91", "92", "93", "94", "95", "62"];
    
    const df = fs.readFileSync('listDrives/list_drives_casino.csv', 'utf-8')
        .split('\n')
        .map(line => line.split(','))
        .filter(arr => departement_scrap.includes(arr[2]));

 
    let df_drivesScraped;
    try {
        df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_casinoScraped.csv`, 'utf-8')
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
            
            console.log(`Scraping ${nom_drive}`);
       

            await page.goto(lien_drive);
           

            // Scrap rayons
            const df_rayons = await searchRayons(page);

            // Scrap tous les produits
            df_produits = await search_produits(page, df_rayons, nom_drive, department, city, today, year, month);

            // Clean data
            await dataPrixClean(df_produits, nom_drive, department, city, nom_driveUrl, today, year, month);

            // Ajout dans les drives scraped
            const dict_drive = {
                id: indexActual,
                supermarket: "Casino",
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
            fs.writeFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_casinoScraped.csv`, df_drivesScraped.map(obj => Object.values(obj).join(',')).join('\n'));
            console.log(`Scraping ${nom_drive} terminé`);
            console.log("--------------------------------------------------------------------------------------------------------------------");
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
                df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_casinoScraped.csv`, 'utf-8')
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

                
                const filePath = `../../Data_base/${year}/${month}/drivesScraped/list_drives_casinoScraped.csv`;
                
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
    const pathExtension ='../Solver-CAPTCHA-gratuit-auto-hCAPTCHA-reCAPTCHA';
    puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: false,
        userDataDir:'./tmp',
  
    }); // Change to true for headless browsing

    // Call the mainLoop function to start the loop
    await mainLoop(browser);
})();