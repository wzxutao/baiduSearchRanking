const ib = require("./InvisibleBrowser");
const settings = require("./Settings");
const alert = require('alert');  // for poping up alert message
const recorder = require('./Recorder')

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
    if(settingDetails.save){
        recorder.csvWriterInit(settingDetails.targetWebsite, settingDetails.keywords);
    }

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

async function searchForKeyword(settingDetails, keyword, records){
    // console.log("正在搜索:" + keyword);
    let ranking = null;
    try{
        ranking = await ib.findTargetResult(settingDetails.targetWebsite, keyword, settingDetails.maxPage);
        if(ranking === -1){
            recorder.setRecord(records, keyword, 'captcha', 'captcha')
            console.log(`${keyword} 触发了安全验证！\n`);
            return -1;
        }
    }catch(err){
        console.log(err.message);
        return;
    }
    
    let willPopUp = true;
    if(ranking == null){
        console.log(`${keyword} ${settingDetails.maxPage}页都找不到 ！\n`);
        recorder.setRecord(records, keyword, 'NotFound', 'NotFound')
        
    }else{
        let rank = ranking.ID > 1000 ? "广告": ranking.ID
        console.log(`\n${keyword} 在第${ranking.page}页第${ranking.NO}项.总排名：${rank}\n`);
        if(ranking.page === 1){
            willPopUp = false;
        }
        recorder.setRecord(records, keyword, ranking.page, ranking.NO)
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

    let records = {}


    let waitForLiftingCaptcha = false;
    for(let i=0; i<settingDetails.keywords.length; i++){
        let keyword = settingDetails.keywords[i];
        let rv = await searchForKeyword(settingDetails, keyword, records);
        if(rv === -1){
            waitForLiftingCaptcha = true;
        }
        await new Promise(resolve => setTimeout(resolve, settingDetails.keywordsInterval * 1000));
    }
    await recorder.recordDateTime(records);
    await recorder.log(records);
    if(waitForLiftingCaptcha){
        console.log(`触发了百度安全验证，休息${settingDetails.breakTimeForSecurityCheck}分钟继续`)
        await new Promise(resolve => setTimeout(resolve, settingDetails.breakTimeForSecurityCheck * 60000));
    }
}

