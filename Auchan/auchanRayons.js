const puppeteer = require('puppeteer-extra')
const fs = require('fs');

async function searchRayons(page) {
    await page.goto('https://www.auchan.fr/');
    await new Promise(r => setTimeout(r, 2000))
    
    // Array to keep the rayons
    const listRayons = [];

    const buttonRayons = await page.$('.navigation__trigger');
    await buttonRayons.click();
    await new Promise(r => setTimeout(r, 2000))
   
    const rayonsHandles = await page.$$('.trigger-sublevel');
    
    // Array of rayons to keep
    const listRayonsKeep = [
        "Marché frais",
        "Produits laitiers, oeufs, fromages",
        "Fruits, légumes",
        "Boucherie, volaille, poissonnerie",
        "Charcuterie, traiteur",
        "Pain, pâtisserie",
        "Surgelés",
        "Epicerie sucrée",
        "Epicerie salée",
        "Eaux, jus, soda, thés glacés",
        "Vins, bières, alcools",
        "Hygiène, beauté",
        "Entretien, accessoires de la maison",
        "Tout pour bébé",
        "Produits du monde et de nos régions",
        "Bio et écologique",
        "Régimes alimentaires et nutrition",
        "Animalerie"
    ];
    
    for (const rayonshandle of rayonsHandles) {
    
        const rayonPrincipalTag = await rayonshandle.evaluate(el => el.querySelector('.navigation-node__title').textContent)
        const rayonPrincipal = rayonPrincipalTag.replace(/  /g, "").replace(/\n/g, "");
       
        if (listRayonsKeep.includes(rayonPrincipal)){
            
            await rayonshandle.click();
            await new Promise(r => setTimeout(r, 2000));
            const rayonsHandlesSec = await rayonshandle.$$('.navigationBlock');
            for (const rayonshandleSec of rayonsHandlesSec) {
    
                const rayonSec = await rayonshandleSec.evaluate(el => el.querySelector('.navigation-block__title').textContent)
                const rayonSecLien = await rayonshandleSec.evaluate(el => el.querySelector('.navigation-block__head').getAttribute('href'))
                
                
                const dictRayons = {
                    'rayon_principal': rayonPrincipal,
                    'rayon_secondaire': rayonSec,
                    'lien_rayon_secondaire': 'https://www.auchan.fr' + rayonSecLien,
                };
                listRayons.push(dictRayons);

                //console.log(dictRayons)
            }
            
            
            await buttonRayons.click();
            await new Promise(r => setTimeout(r, 2000));
            await buttonRayons.click();
            await new Promise(r => setTimeout(r, 2000));
        }
        
        
    }
    //console.log(listRayons)
    // Convert data to DataFrame equivalent in JavaScript
    const dfRayons = listRayons.filter(rayon => listRayonsKeep.includes(rayon.rayon_principal));
    
    
    // Write to CSV
    const csvContent = dfRayons.map(rayon => `"${rayon.rayon_principal}","${rayon.rayon_secondaire}",${rayon.lien_rayon_secondaire}`).join('\n');
    fs.writeFileSync('Auchan_rayons.csv', csvContent);
    
    return dfRayons;
}


(async () => {
    puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: false,
        userDataDir:'./tmp',
     
    }); // Change to true for headless browsing
    const page = await browser.newPage();
    
    await searchRayons(page);
})();