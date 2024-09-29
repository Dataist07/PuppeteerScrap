

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
                
            }, 700);
            
        });
    }, posMax);  // pass posMax to the function
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function page_produits(page, rayonPrincipal,rayonSecondaire, list_page_produits = []) {
    await page.waitForSelector('.product-thumbnail__content-wrapper');
    
    const produits_tag = await page.$$('.product-thumbnail__content-wrapper');

    for (const produit of produits_tag) {
        try {
                        
        
            const nom_produit = await produit.evaluate(el => el.querySelector('.product-thumbnail__description').textContent);

            const prix_produit = await produit.evaluate(el => el.querySelector('.product-thumbnail__price').textContent);
    
            const attribut_produit = await produit.evaluate(el => {
                const spans = el.querySelectorAll('div.product-thumbnail__attributes > span');
                return spans[spans.length - 1].textContent;
            });
            
            const lien_image = await produit.$('.product-thumbnail__picture');

            const lien_image_src = await page.evaluate(lien_image => {
                const imgElement = lien_image.querySelector('img');
                return imgElement ? imgElement.getAttribute('srcset') : null;
            }, lien_image);

           
            const dict_produit = {
                'rayon_principal': rayonPrincipal,
                'rayon_secondaire': rayonSecondaire,
                'nom_produit': nom_produit.replace(/\n/g, "").replace(/   /g, "").replace(/  /g, ""),
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

async function search_produits(page, df_rayons, nom_drive, department, city, today, year, month) {
    const list_produits = [];
    
    
    for (const rayon of df_rayons)  {
     
        const rayonPrincipal = rayon.rayon_principal;
        const rayonSecondaire = rayon.rayon_secondaire;
        const lien_rayon = rayon.lien_rayon_secondaire;
        const rayonPeuUtile = ['Champagnes, vins effervescents','Mouchoirs, protections hygiéniques, petite parapharmacie'
            ,'Accessoires ménagers, maison','Puériculture','Chat','Chien','Rongeurs, oiseaux, poissons','Accessoires animalerie' ];
        
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

    fs.writeFileSync(`${newpath}/Auchan_produits.csv`, df_produits.map(obj => Object.values(obj).join(',')).join('\n'));
    
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

        let prix_rat_trans;
        let unite;
        try {
            const index_slash = prixrat.lastIndexOf('/');
            const euro = prixrat.lastIndexOf('€');
            prix_rat_trans = parseFloat(prixrat.slice(0, euro - 1).replace(",", "."));
            unite = prixrat.slice(index_slash)
        } catch (error) {
            prix_trans = 0;
            unite = ''
        }

        
        let lien_image_trans;
        try {
            const virgule = lien_image.lastIndexOf(',');
            lien_image_trans = lien_image.slice(virgule +2);
            
        } catch (error) {      
            lien_image_trans = ''
        }
      

        let nom_produit = df_produits[i]['nom_produit'].toString();
        const dict_produit = {
            'supermarket': "Auchan",
            'nom_drive': nom_drive.replace(/,/g, ""),
            'nom_driveUrl': nom_driveUrl.replace(/,/g, ""),
            'rayon_principal': df_produits[i]['rayon_principal'],
            'rayon_secondaire': df_produits[i]['rayon_secondaire'],
            'nom_produit': nom_produit.replace(/,/g, "").replace(/Œ/g, 'Oe').replace(/œ/g, "oe"),
            'prix_produit': prix_trans,
            'prix_ratio': prix_rat_trans,
            'unite': unite.replace(/,/g, ""),
            'lien_image': lien_image_trans.replace(/,/g, ""),
        };
        //console.log(dict_produit)

        list_produits.push(dict_produit);
    }

    // Processing DataFrame
    const df_produits_clean = list_produits.filter(prod => prod.prix_produit !== 0 && prod.prix_ratio !== 0 && prod.lien_image !== '' && prod.unite !== '');
    const uniqueProds = new Set(df_produits_clean.map(JSON.stringify));
    const uniqueData = Array.from(uniqueProds).map(JSON.parse);

    // Convert the processed data to CSV and save
    

    const filePath = `../../Data_base/${year}/${month}/${department}/${city}/${nom_drive}/${today}/Auchan_produits.csv`;
    
    fs.writeFileSync(filePath, ''); // Clear the file
    fs.appendFileSync(filePath, 'supermarket,nom_drive,nom_driveUrl,rayon_principal,rayon_secondaire,nom_produit,prix_produit,prix_ratio,unite,lien_image\n');

    uniqueData.forEach(item => {
        fs.appendFileSync(filePath, `${Object.values(item).join(',')}\n`);
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function scrapAll(today,year,month,page) {
    
    
    // Choisir les départements à scrap
    const departement_scrap = [
        ...Array.from({ length: 100 }, (_, i) => String(i).padStart(2, "0"))
      ];
    console.log(departement_scrap)     
    const df = fs.readFileSync('listDrives/list_drives_auchan.csv', 'utf-8')
        .split('\n')
        .map(line => {
            // Use regular expression to split the line by comma, but not if it's inside quotes
            return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        })
        .filter(arr => departement_scrap.includes(arr[2]));

 
    let df_drivesScraped;
    try {
        df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_auchanScraped.csv`, 'utf-8')
            .split('\n')
            .map(line => {
                // Use regular expression to split the line by comma, but not if it's inside quotes
                return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
            })
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
        if (i==0){
            try {
                
                await page.goto(lien_drive);
                
                //await page.waitForSelector('.banner-close-button');
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
            const buttonDrive = await page.$('.store-info__button');
            await buttonDrive.click();
            await new Promise(r => setTimeout(r, 1000))

            // Scrap rayons
            let df_rayons = fs.readFileSync(`Auchan_rayons.csv`, 'utf-8')
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
                supermarket: "Auchan",
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

            fs.writeFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_auchanScraped.csv`, df_drivesScraped.map(obj => Object.values(obj).join(',')).join('\n'));
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
        
            await scrapAll(today, year, month,page).then(() => {
                console.log('Scraping completed successfully.');
                let df_drivesScraped;
                df_drivesScraped = fs.readFileSync(`../../Data_base/${year}/${month}/drivesScraped/list_drives_auchanScraped.csv`, 'utf-8')
                        .split('\n')
                        .map(line => {
                            // Use regular expression to split the line by comma, but not if it's inside quotes
                            return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
                        })
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
                const filePath = `../../Data_base/${year}/${month}/drivesScraped/list_drives_auchanScraped.csv`;
                
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
