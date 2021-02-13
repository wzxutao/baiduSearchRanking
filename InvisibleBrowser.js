const puppeteer = require('puppeteer'); // headless chrome


let browser;
let currentPage;

/*
0: run-time default
>=1: debug
1: new page log, got captcha log
2: clear page log
3: print page.url()
*/
let verbosity = 0;
// take screen shot when error occurred. for debugging
let should_takeScreenshot = 0;


let initialResultPageUrl = null;
// sleeps for n minutes after activated baidu's security check
let breakTimeForSecurityCheck = 5;

async function init(settings){
    browser = await puppeteer.launch();

    initialResultPageUrl = "https://www.baidu.com/s?wd=";
    breakTimeForSecurityCheck = settings.breakTimeForSecurityCheck;
}

async function exit(){
    await browser.close();
}

/**
 * @returns null if not found, otherwise: 
 * {
 * page: page number in which the result was found
 * ID: overall ranking in result (combining all pages)
 * NO: the ranking of the result in this page
 * }
 * @param {search for the url of the website displayed in the search result} url 
 * @param {stop searching until this page (inclusive)} maxPage 
 */
async function findTargetResult(url, keyword, maxPage){
    let pageNumber = 1;
    let results = await getPageResultList(initialResultPageUrl + keyword);
    if(results === null){
        throw new Error('session abandoned');
    }
    if(await results === -1){
        return -1;
    };

    let ranking = await findTargetWebsiteInPageResults(url, await results);
    if(ranking != null){
        return {
            page: pageNumber,
            ID: ranking.ID,
            NO: ranking.NO
        }
    }

    while(pageNumber < maxPage){
        pageNumber++;
        if(verbosity > 0){
            console.log(`正在搜索第${pageNumber}页`)
        }
        if(await results === -1) return -1;
        results = await getPageResultList(await getNextPageHref());
        if(results === null){
            throw new Error('session abandoned');
        }
        ranking = await findTargetWebsiteInPageResults(url, results);
        if(ranking != null){
            return {
                page: pageNumber,
                ID: ranking.ID,
                NO: ranking.NO
            }
        }
    }

    return null;
}

/**
 * @returns null if not found {ID, NO} otherwise
 * @param {url of the target website to search for} targetUrl 
 * @param {results acquired from getPageResultList} results 
 */
async function findTargetWebsiteInPageResults(targetUrl, results){
    for(let i=0; i<results.length; i++){
        let result = results[i];
        let url = result.URL;
        if(url.includes(targetUrl)){
            return{
                ID: result.ID,
                NO: i + 1,
            }
        }
    }
    return null;
}

async function getUrlAndIdList(){
    // returns the search results. as an array of ElementHandle(s)
    const results = await currentPage.$$(".c-container.new-pmd");

    const urlIdPairs = [];

    for(let i=0; i<results.length; i++){
        // type: ElementHandle
        let currentBlock = results[i];
        // the id of the block. the blockes are displayed in order in terms of ascending id
        let id = await (await currentBlock.getProperty("id")).jsonValue();
        // console.log(id);

        let linkAnchorBox = await currentBlock.$(".f13 > a");   // normal results
        if(await linkAnchorBox === null){
            linkAnchorBox = await currentBlock.$(".c-showurl")
        }
        if(await linkAnchorBox === null){
            linkAnchorBox = await currentBlock.$('div > a > span') // ads
        }
        if(await linkAnchorBox === null){
            // if((await getAttribute(currentBlock, "tpl")) === "recommend_list"){ //其他人还在搜
            //     continue;
            // }
            continue;
        }

        const displayedUrl = await getText(linkAnchorBox);
        
        urlIdPairs.push({
            URL: displayedUrl,
            ID: id,
        })
    }
    return urlIdPairs;
}

// get the Text of the element as string
async function getText(elementHandle){
    return await (await elementHandle.getProperty('textContent')).jsonValue();   
}

// get the attr of the element as string
async function getAttribute(elementHandle, attr){
    return await (await elementHandle.getProperty(attr)).jsonValue();  
}

// // trying to deceive baidu's security check. not sure whether it works or not
// async function setHeaders(page){
//     await page.setExtraHTTPHeaders({
//         'Accept': 'application/json, text/javascript, */*; q=0.01',
//         'Accept-Encoding': 'gzip, deflate, br',
//         'Accept-Language': 'zh-CN,zh;q=0.9',
//         'Connection': 'Keep-Alive',
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
//         'sec-ch-ua': '"Google Chrome";v="87", " Not;A Brand";v="99", "Chromium";v="87"'
//     })
// }

// open page with url
async function openPage(url){
    await closeAllPages();
    newPage = await browser.newPage();
    // await setHeaders(newPage);
    try{
        // let waitPromise = newPage.waitForNavigation({waitUntil: 'networkidle0'})
        await newPage.goto(url, { waitUntil: 'domcontentloaded' });
        currentPage = await newPage;
    
        if(verbosity === 3){
            console.log(await currentPage.url());
        }
        // await waitPromise;
        if(verbosity === 1){
            console.log('new page')
        }
    }catch(err){
        console.error(err.message);
        await takeScreenshot();
        throw err
    }
    
}

// returns the href attribute of the a tag of the next page button as string
async function getNextPageHref() {
    let nextPageBtns = await currentPage.$$("a.n")

    // the buttons for going to the previous page and the next page has the same selector
    for(const nextPageBtn of nextPageBtns){
        if((await getText(nextPageBtn)).includes("下一页")){
            let nextpageHref = await getAttribute(nextPageBtn, "href");
            return nextpageHref;
        }
    }

    throw new Error("unable to find the next page button");  
}

async function takeScreenshot(){
    if(!should_takeScreenshot) return;
    const tNow = new Date();

    let dateNow = tNow.toDateString()
    let timeNow = tNow.toLocaleTimeString().replace(/:/g, "-")
    let path = 'screenshots/' + dateNow + timeNow + '.png'
    await currentPage.screenshot({path: path})
    console.log('screenshot taken')
}

// reuturns true if baidu responded with captcha
async function checkSecurityBan(){
    let url = await currentPage.url();
    return url.includes('wappass.baidu.com/static/captcha')
}


// returns -1 if baidu returned captcha
var tried = false;
async function getPageResultList(url){
    try{
        await openPage(url);
        urlIdList = await getUrlAndIdList(currentPage);
        if(await urlIdList.length > 0){
            tried = false;
            return urlIdList;
        } 
        if(await checkSecurityBan()){
            if(verbosity === 1){
                console.log('got captcha')
            }
            return -1;
        }

        await new Promise(resolve => setTimeout(resolve, 4000));
        await takeScreenshot()
        if(verbosity >= 1){
            console.log(await currentPage.url());
        }
        return await getPageResultList(url);
    }catch(err){
        console.error(err.message);
        // try one more time
        if(!tried){
            tried = true;
            console.log('正在重试...')
            return await getPageResultList(url);
        }
        
        // if(err.message.includes('Navigation timeout')){
        //     console.error(`大概率触发了百度安全验证，休息${breakTimeForSecurityCheck}分钟继续`)
        // }
        // await new Promise(resolve => setTimeout(resolve, breakTimeForSecurityCheck * 60000));
        return null;
    }

}

async function closeAllPages(){
    const maxPageCount = 10;

    let pages = await browser.pages();
    if(pages.length < maxPageCount) return;

    if(verbosity == 2){
        console.log('clearing browser pages')
    }
    for(let i=0; i<pages.length; i++){
        await pages[i].goto('about:blank')
        await pages[i].close()
    }
}
module.exports = {init, exit, openPage, findTargetResult};