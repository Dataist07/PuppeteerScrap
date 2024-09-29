

const puppeteer = require('puppeteer-extra')
const fs = require('fs');

async function searchRayons(page) {
    await page.waitForSelector('.mainbar-item__content');

    const rayonsButon = await page.$('.mainbar-item__content');
    await rayonsButon.click();

    // Array to keep the rayons
    const listRayons = [];
   
    const rayonTags = await page.$$('.menu-rayon-item');

    for (let i = 0; i < rayonTags.length; i++) {
        const rayon = rayonTags[i];
        const rayonPrincipal = await rayon.$('a');

        if (i > 16) {
            await page.evaluate(element => {
                element.scrollIntoView(true);
            }, rayonPrincipal);
            await page.waitForTimeout(500);
        }

        // Move the mouse to the element to trigger any hover actions
        await rayon.hover();
        await page.waitForTimeout(1000);

        // Get all the sub-rayon elements
        const subRayonTags = await rayon.$$('.menu-rayon-item');
        for (const subRayon of subRayonTags) {
            const lienSub = await subRayon.$('a');
            const lienSubHref = await page.evaluate(el => el.href, lienSub);

            const dictRayons = {
                'rayon_principal': await page.evaluate(el => el.textContent, rayonPrincipal),
                'rayon_secondaire': await page.evaluate(el => el.textContent, subRayon),
                'lien_rayon_secondaire': lienSubHref
            };
            console.log(dictRayons)
            listRayons.push(dictRayons);
        }
    }

    // Convert to DataFrame equivalent and apply filtering
    const listRayonsKeep = ['Mon marché frais', 'Bio et Ecologie', 'Fruits et Légumes', 'Viandes et Poissons', 'Pains et Pâtisseries',
        'Crèmerie et Produits laitiers', 'Charcuterie et Traiteur', 'Surgelés', 'Boissons',
        'Epicerie salée', 'Epicerie sucrée', 'Produits du monde', 'Produits régionaux et locaux', 'Nutrition et Végétale',
        'Bébé', 'Hygiène et Beauté', 'Entretien et Nettoyage', 'Animalerie'];

    const listSubRayonsDrop = ['Maquillage', 'Premiers soins et Préservatifs', 'Hygiène et Prévention Covid-19', 'Bien-être', 'Désodorisants et Bougies',
        'Accessoires de ménage', 'Ampoules et Piles', 'Allumettes et allume-feux', 'Entretien et Nettoyage Covid-19', 'NOUVEAU',
        'Cave à Vins', 'Les produits Carrefour', 'Apéritifs et Spiritueux', 'Champagnes et Pétillants', 'NEW !', 'Promenade', 'Voyage',
        'Chambre', 'Eveil', 'Vêtements', 'Maternité et naissance', 'Rongeurs', 'Oiseaux', 'Reptiles', 'Basse-cour', 'Chevaux'];

    listRayons = listRayons.filter(item => 
        listRayonsKeep.includes(item.rayon_principal) &&
        !listSubRayonsDrop.some(sub => item.rayon_secondaire.includes(sub))
    );

    listRayons = listRayons.filter(item => item.rayon_secondaire.trim() !== '');
    listRayons = Array.from(new Set(listRayons.map(a => a.lien_rayon_secondaire)))
        .map(lien_rayon_secondaire => {
            return listRayons.find(a => a.lien_rayon_secondaire === lien_rayon_secondaire);
        });

    // Convert to CSV
    const csv = parse(listRayons, { fields: ['rayon_principal', 'rayon_secondaire', 'lien_rayon_secondaire'] });
    fs.writeFileSync(path.join(__dirname, 'rayons_carrefour.csv'), csv);

    console.log('CSV file has been saved.');

    
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
    
    const df = fs.readFileSync('listDrives/list_drives_carrefourMarket_processed.csv', 'utf-8')
        .split('\n')
        .map(line => line.split(','))
        .filter(arr => departement_scrap.includes(arr[2]));

 
    let df_drivesScraped;
    try {
        df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_carrefourMarketScraped.csv`, 'utf-8')
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
        console.log(lien_drive)
        if (i==0){
            try {
                
                await page.goto(lien_drive);
                await page.waitForSelector('#onetrust-reject-all-handler');
                const buttonUnaccept = await page.$('#onetrust-reject-all-handler');
                await buttonUnaccept.click();
            
            } catch {
              
            }
        }
        
        if (indexLastDriveScraped < indexActual) {
            const nom_drive = df[i][3];
            const department = df[i][2];
            const city = df[i][5];
            const nom_driveUrl = df[i][4];
            
            console.log(`Scraping ${nom_drive}`);
       

            await page.goto(lien_drive);
            await page.focus('#data-store-cta_choisir > div:nth-child(1) > div > div > a');
            const lienDrive = await page.$('#data-store-cta_choisir > div:nth-child(1) > div > div > a');
            await lienDrive.click()
           

            // Scrap rayons
            const df_rayons = await searchRayons(page);

            // Scrap tous les produits
            df_produits = await search_produits(page, df_rayons, nom_drive, department, city, today, year, month);

            // Clean data
            await dataPrixClean(df_produits, nom_drive, department, city, nom_driveUrl, today, year, month);

            // Ajout dans les drives scraped
            const dict_drive = {
                id: indexActual,
                supermarket: "CarrefourMarket",
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
            fs.writeFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_carrefourMarketScraped.csv`, df_drivesScraped.map(obj => Object.values(obj).join(',')).join('\n'));
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
            const month = "6";
            const today = new Date().toISOString().slice(0, 10);
   
            const page = await browser.newPage();
        
            await scrapAll(today, year,month,page).then(() => {
                console.log('Scraping completed successfully.');
                let df_drivesScraped;
                df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_carrefourMarketScraped.csv`, 'utf-8')
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

                
                const filePath = `../../Data_base/${year}/${month}/drivesScraped/list_drives_carrefourMarketScraped.csv`;
                
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
        //userDataDir:'./tmp',
   
    }); // Change to true for headless browsing

    // Call the mainLoop function to start the loop
    await mainLoop(browser);
})();
