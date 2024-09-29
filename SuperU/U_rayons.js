const puppeteer = require('puppeteer-extra')
const fs = require('fs');

async function searchRayons(page) {
    await page.waitForSelector('.categories-menu');
    const butonRef = await page.$('#popin_tc_privacy_button');
    await butonRef.click()

    const myList = ['Nouveautés', '\nPRIX COÛTANT\n', '\nPRIX MINI\n'];
    // Array to keep the rayons
    const listRayons = [];

    const rayonsHandles = await page.$$('.categories-menu');

    
    for (const rayonshandle of rayonsHandles) {
        const rayonPrincipal = await rayonshandle.evaluate(el => el.querySelector('.category-level-one-text').textContent)
        console.log('a'+rayonPrincipal+'a')
        if (!myList.includes(rayonPrincipal)) {
            await rayonshandle.click()

            await page.waitForSelector('.navigation__item.su-font-roboto.category-level.clearfix');
            await new Promise(resolve => setTimeout(resolve, 5000));

            //#navigation > div.navigation__scrolling-content > div.simplebar-scroll-content > div > div > ul > li:nth-child(7) > div > div.menu-vertical > div > div.simplebar-scroll-content > div > a.navigation__item.su-font-roboto.category-level.navigation__item--more.navigation__item--third.navigation-without-arrow.slide
            const rayonsSecondHandles = await rayonshandle.$$('.navigation__item.su-font-roboto.category-level.clearfix');
            console.log(rayonsSecondHandles)
            for (const rayonsSecondHandle of rayonsSecondHandles) {
                try {
                    const rayonsSecond = await rayonsSecondHandle.evaluate(el => el.textContent);
                    console.log(rayonsSecond)
                    const lienSecondRayons = await rayonsSecondHandle.evaluate( element => element.getAttribute('href'));
                    console.log(lienSecondRayons)
                    const dictRayons = {
                        'rayon_principal': rayonPrincipal.replace(/\n/g, ""),
                        'rayon_secondaire': rayonsSecond.replace(/\n/g, ""),
                        'lien_rayon_secondaire': lienSecondRayons,
                    };
                    listRayons.push(dictRayons);
                    console.log(dictRayons)
                } catch (error) {}
            }
        }
        
    }
    
    // Array of rayons to keep
    const listRayonsKeep = [
        "Fruits et Légumes",
        "Bio",
        "Viandes, poissons",
        "Pains, Viennoiseries et Pâtisseries",
        "Produits frais",
        "Charcuterie, traiteur",
        "Surgelés",
        "Epicerie salée",
        "Epicerie sucrée",
        "Nutrition et régimes alimentaires",
        "Boissons sans alcool",
        "Bières, vins, alcools",
        "Univers bébé",
        "Hygiène et beauté",
        "Entretien et nettoyage",
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
    fs.writeFileSync('U_rayons.csv', csvContent);
    
    return filteredRayons;
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

(async () => {

    puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: false,

    }); // Change to true for headless browsing
    const page = await browser.newPage();

    await addCookiesFromFile(page, 'cookies.txt');
    await page.goto('https://www.coursesu.com/?store=66152');

    await searchRayons(page);
})();