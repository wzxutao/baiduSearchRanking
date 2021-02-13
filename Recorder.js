const createCsvWriter = require('csv-writer').createObjectCsvWriter
const fs = require('fs');
const logDir = 'log';
if(!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

let verbosity = 0;

let csvPath = null;

// if false disable all methods that is associated with csv writing
let should_save = false;
let csvWriter = null;



function csvWriterInit(targetWebsite, keywords){
    should_save = true;
    const tNow = new Date();

    let dateNow = tNow.toDateString()
    let timeNow = tNow.toLocaleTimeString().replace(/:/g, "-")
    let csvFileName = dateNow + timeNow + ".csv";
    csvPath = logDir + '/' + targetWebsite + '#' + csvFileName;

    let header = []
    for(let i=0; i<keywords.length; i++){
        const keyword = keywords[i];
        header.push({id:keyword + '_p', title: keyword + "_页"})    // page
        header.push({id:keyword + '_r', title: keyword + "_页内排名"})    // ranking
    }
    header.push({id:'DATE', title: 'DATE'})
    header.push({id:'TIME', title: 'TIME'})
    csvWriter =  createCsvWriter({
        path: csvPath,
        header: header,
    });
}

// returns current {DATE, TIME}
function getDateAndTimeNow(){
    const tNow = new Date();
    let dateNow = tNow.toDateString();
    let timeNow = tNow.toLocaleTimeString();
    return {DATE: dateNow, TIME: timeNow}
}

// records : json object
async function log(records){
    if(!should_save) return;
    if(verbosity === 1){
        console.log(records);
    }
    await csvWriter.writeRecords([records])
    console.log('记录已保存到./' + csvPath)
}

// records: json object
function setRecord(records, keyword, pageFound, rankingAtPage){
    if(!should_save) return;
    records[keyword+'_p'] = pageFound;
    records[keyword+'_r'] = rankingAtPage
}

async function recordDateTime(records){
    if(!should_save) return;
    let dt = getDateAndTimeNow()
    records.DATE = dt.DATE
    records.TIME = dt.TIME
}


module.exports = {csvWriterInit, log, getDateAndTimeNow, setRecord, recordDateTime}



