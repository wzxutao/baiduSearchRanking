const ib = require("./InvisibleBrowser");
const settings = require("./Settings");
const alert = require('alert');  // for poping up alert message

// continue if its ordinary error including network timeout, no more if customized error 
// occurred including not finding the target in the first page.
var is_continuing = true;

(async () => {
    start();
})();

async function start(){
    await settings.loadSettings();
    let settingDetails = await settings.getSettingDetails();
    await ib.init(await settingDetails);  // boot the browser

    await startSearchingSession(settingDetails);  // search for the first time
    // search regularly
    await repeatSearch(settingDetails)

    
}

async function repeatSearch(settingDetails){
    if(!is_continuing) return;
    setTimeout(async () => {
        try{
            await startSearchingSession(await settingDetails);
        }catch(err){
            console.error(err.message);
        }
        
        repeatSearch(await settingDetails);
    }, settingDetails.repeatInterval * 1000)
}

async function searchForKeyword(settingDetails, keyword){
    // console.log("正在搜索:" + keyword);
    let ranking = null;
    try{
        ranking = await ib.findTargetResult(settingDetails.targetWebsite, keyword, settingDetails.maxPage);
    }catch(err){
        console.log(err.message);
        return;
    }
    
    let willPopUp = true;
    if(ranking == null){
        console.log(`${keyword} ${settingDetails.maxPage}页都找不到 ！`);
    }else{
        let rank = ranking.ID > 1000 ? "广告": ranking.ID
        console.log(`\n${keyword} 在第${ranking.page}页第${ranking.NO}项.总排名：${rank}\n`);
        if(ranking.page === 1){
            willPopUp = false;
        }
    }
    if(willPopUp && settingDetails.alert){
        alert(`${keyword} 已经不在第一页了！！！`)
        // is_continuing = false;
        // throw new Error("不在第一页了 我不想继续找了")
        
    }
}


async function startSearchingSession(settingDetails){
    console.log("-".repeat(80))
    console.log(`正在百度${settingDetails.targetWebsite}`)

    for(let i=0; i<settingDetails.keywords.length; i++){
        let keyword = settingDetails.keywords[i];
        await searchForKeyword(settingDetails, keyword);
        await new Promise(resolve => setTimeout(resolve, settingDetails.ketwordsInterval * 1000));
    }
}

