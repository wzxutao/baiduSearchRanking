const {createInterface} = require("readline");    // for getting user input 
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});
const fs = require("fs");

const saveFileName = "settings.json";

let settingDetails = null;

// asks the user to set all of the settings
async function setAll(){
    const seperators = [",", "，"]

    settingDetails = {};
    settingDetails.targetWebsite = await getLine("要查询什么网站的排名？：")
    settingDetails.keywords = await getLine("百度搜索的关键词（逗号分隔）：")
    settingDetails.keywords = splitKeywords(await settingDetails.keywords, seperators)
    console.log(settingDetails.keywords);
    settingDetails.maxPage = await getLine("最多找几页？：", true)
    settingDetails.keywordsInterval = await getLine("不同关键词之间隔多少秒查找？：", true)
    settingDetails.repeatInterval = await getLine("查询结束后过多少秒自动再次查找？：", true)
    settingDetails.breakTimeForSecurityCheck = await getLine("触发百度安全验证后过多少分钟重试？（建议>=5）：", true)
    let choice = await getLine("掉出第一页就弹窗提示？Y/N 默认Y: ", false, true);
    settingDetails.alert = (choice.toUpperCase() === "N" ? 0 : 1)
    choice = await getLine("保存记录？Y/N 默认Y: ", false, true);
    settingDetails.save = (choice.toUpperCase() === "N" ? 0 : 1)

    // write settings to file
    const data = JSON.stringify(settingDetails);
    await new Promise(resolve => {
        fs.writeFile(saveFileName, data, (err) => {
            if(err){
                throw err;
            }
            console.log("设置信息已保存\n")
            resolve();
        })
    })
}

function splitKeywords(srcStr, seperators){
    let l = 0;
    let r = 0;
    let arr = []

    for(let i=0; i<srcStr.length; i++){
        let ch = srcStr.charAt(i);

        let is_seperator = false;
        for(let j=0; j<seperators.length; j++){
            let seperator = seperators[j];
            if(seperator === ch){
                arr.push(srcStr.substring(l, r));
                r++;
                l = r;
                is_seperator = true;
                break;
            }
        }
        if(!is_seperator){
            r++;
        }
    }
    if(l !== r){
        arr.push(srcStr.substring(l, r));
    }
    return arr;
}

// check whether the setting file contains all the fields needed
// returns false if check failed
function checkSettingFile(settingsToCheck){
    const attrs = ['targetWebsite', 'keywords', 'maxPage', 'keywordsInterval', 'repeatInterval',
        'breakTimeForSecurityCheck', 'alert', 'save'
    ]

    for(let i=0; i<attrs.length; i++){
        if(settingsToCheck[attrs[i]] === undefined){
            console.log('检测到了设置文件但其版本太低 需要重新设置\n')
            return false;
        }
    }
    return true;
}

async function loadSettings(){
    let willSet = false;
    try{
        let readData = fs.readFileSync(saveFileName);
        settingDetails = JSON.parse(readData);
        if(!checkSettingFile(settingDetails)) return setAll();
        let choice = await getLine("使用上次的设置？Y/N 默认Y: ", false, true)
        if(choice.toUpperCase() === "N"){
            willSet = true;
        }
    }catch(err){
        willSet = true;
    }

    if(willSet){
        await setAll();
    }
}

async function getSettingDetails(){
    return settingDetails;
}


async function getLine(question, is_positiveInteger = false, askOnlyOnce = false){
    let answer;
    do{
        answer = await new Promise(resolve => {
            rl.question(question, (answer) => {
                if(is_positiveInteger){
                    answer = parseInt(answer);
                    if(answer === NaN || answer <= 0){
                        answer = null;
                    }
                }
                resolve(answer)
            })
        })
        
    }while(!answer && !askOnlyOnce)
    
    return answer
}

module.exports = {getLine, getSettingDetails, loadSettings}