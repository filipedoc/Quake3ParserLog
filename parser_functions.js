var mGlogalRanking = new Map();
var mGlogalRankingSort;

function parserData(buffer) {

    let aBlocks, aMatches, aMatchesWithKills;
    let szReport = "";
    let separator = "------------------------------------------------------------\n";

    aBlocks = buffer.split(separator);

    //filtering blocks to find valid matches
    aMatches = aBlocks.filter(e => e.split(/\r\n|\r|\n/).length > 1);

    //filtering matches to find matches with kills
    aMatchesWithKills = aMatches.filter(e => e.includes("Kill: "));

    //Treatment for matches with kills
    aMatchesWithKills.forEach((aMatch, iIndex) => {
        szReport += "\"game_" + (iIndex + 1) + "\": {\n";
        szReport += stParserEachMatch(aMatch);
        szReport += "\n}\n";
    });

    //Adding global player ranking
    szReport += "\"player_ranking\": {\n";
    mGlogalRankingSort.forEach((value, key) => { szReport += "\t\"" + key + "\": " + mGlogalRankingSort.get(key) + ",\n"; });
    szReport += "}\n";

    return szReport;
}

function stParserEachMatch(aMatch) {

    let aMatchLines, aPlayersLines, aKillsLines;
    let aFinalPlayers, aFinalKills;

    aMatchLines = aMatch.split("\n");

    //Getting lines with players names
    aPlayersLines = aMatchLines.filter(e => e.includes("ClientUserinfoChanged: "));
    aFinalPlayers = aAnalyzePlayers(aPlayersLines);

    //Getting lines with information about kills and weapons (or reasons of the dead).
    aKillsLines = aMatchLines.filter(e => e.includes("Kill: "));
    aFinalKills = aAnalyzeKills(aKillsLines);

    //Creating the final script
    return stCreateFinalScript(aFinalPlayers, aFinalKills);
}

function aAnalyzePlayers(szPlayers) {

    let szStartNameIndicator = " n\\", szFinalNameIndicator = "\\t";
    let iStartPlayerName = 0, iFinalPlayerName = 0, iHold = 0;
    let szPlayerName = "";
    let aAllNames = [], aNamesWithoutRepetition = [];

    szPlayers.forEach((szLine) => {

        //Obtaining all the players name of the game
        iStartPlayerName = szLine.indexOf(szStartNameIndicator, iHold + 1);
        iFinalPlayerName = szLine.indexOf(szFinalNameIndicator, iStartPlayerName + 1);
        szPlayerName = szLine.substring(iStartPlayerName + szStartNameIndicator.length, iFinalPlayerName);
        aAllNames.push(szPlayerName);

        //Removing repeated names
        aNamesWithoutRepetition = [...new Set(aAllNames)];
    });

    return aNamesWithoutRepetition;
}

function aAnalyzeKills(szKills) {

    let aAllKills;
    let iHold = 0;
    let szStartWhoIndicator = ": ", szFinalWhoIndicator = " killed";
    let iStartWhoName = 0, iFinalWhoName = 0;
    let szStartDeadIndicator = "killed ", szFinalDeadIndicator = " by";
    let iStartDeadName = 0, iFinalDeadName = 0;
    let aWords;

    aAllKills = new Array(szKills.length);

    szKills.forEach((szLine, index) => {

        aAllKills[index] = new Array(3);
        iHold = 0;

        //Getting who killed
        iStartWhoName = szLine.lastIndexOf(szStartWhoIndicator);
        iFinalWhoName = szLine.indexOf(szFinalWhoIndicator, iStartWhoName + 1);

        //Getting who is dead
        iStartDeadName = szLine.indexOf(szStartDeadIndicator, iHold + 1);
        iFinalDeadName = szLine.indexOf(szFinalDeadIndicator, iStartDeadName + 1);

        //Getting the weapon (or reason of the dead).
        aWords = szLine.split(" ");

        //Saving information [0 - Who killed] [1 - Who Died] [2 - Weapon Used]
        aAllKills[index][0] = szLine.substring(iStartWhoName + szStartWhoIndicator.length, iFinalWhoName);    //Who killed
        aAllKills[index][1] = szLine.substring(iStartDeadName + szStartDeadIndicator.length, iFinalDeadName); //Dead
        aAllKills[index][2] = aWords[aWords.length - 1];                                                      //Weapon
    });

    return aAllKills;
}

function stCreateFinalScript(aPlayers, aKills) {

    let stScript = "";

    stScript += "\t\"total_kills\": " + aKills.length + ",\n";
    stScript += stFormatPlayers(aPlayers);
    stScript += stManageKillsAndWeapons(aPlayers, aKills);
    stScript += "\t}";

    return stScript;
}

function stFormatPlayers(aPlayers) {

    let stPlayerScript = "";
    let stFinalScript = "";

    //Formatting players
    aPlayers.forEach(player => {
        stPlayerScript += "\"" + player + "\",";
    });

    //Mounting the final script with the players name
    stFinalScript = "\t\"players\": [";
    stFinalScript += stPlayerScript;
    stFinalScript += "],\n";

    return stFinalScript;
}

function stManageKillsAndWeapons(aPlayers, aKillLines) {

    let mPlayerskills = new Map();
    let mDeadsByWorld = new Map();
    let mFinalKills = new Map();
    let mFinalsWeapons = new Map();
    let stKillsScript = "";
    let stWeaponsScript = "";
    let stFinalScript = "";

    //Initializing maps with all the players
    for (let index = 0; index < aPlayers.length; index++) {
        mPlayerskills.set(aPlayers[index], 0);
        mDeadsByWorld.set(aPlayers[index], 0);
        mFinalKills.set(aPlayers[index], 0);
    }

    //Counting the weapons
    for (let index = 0; index < aKillLines.length; index++) {
        if (!mFinalsWeapons.has(aKillLines[index][2])) {
            mFinalsWeapons.set(aKillLines[index][2], 1);
        } else {
            mFinalsWeapons.set(aKillLines[index][2], (mFinalsWeapons.get(aKillLines[index][2]) + 1));
        }
    }

    //Counting kills
    mPlayerskills.forEach((value, key) => {
        aKillLines.forEach((szLine) => {
            if (szLine[0] == key) {
                mPlayerskills.set(key, ++value);
            }
        });
    });

    //Counting deads by <world>
    mDeadsByWorld.forEach((value, key) => {
        aKillLines.forEach((szLine) => {
            if (szLine[1] == key) {
                if (szLine[0] == "<world>") {
                    mDeadsByWorld.set(key, ++value);
                }
            }
        });
    });

    //Subtracting <world> deads from real kills and formatting the final script with the kills 
    mFinalKills.forEach((value, key) => {
        mFinalKills.set(key, (mPlayerskills.get(key) - mDeadsByWorld.get(key)));
        stKillsScript += "\t\t\"" + key + "\": " + mFinalKills.get(key) + ",\n";
    });

    //Formatting the final script with the weapons (or reason of the dead)
    mFinalsWeapons.forEach((value, key) => {
        stWeaponsScript += "\t\t\"" + key + "\": " + mFinalsWeapons.get(key) + ",\n";
    });

    //Mounting the final script with kills and kills_by_means
    stFinalScript = "\t\"kills\": {\n";
    stFinalScript += stKillsScript + "\t},\n";
    stFinalScript += "\t\"kills_by_means\": {\n";
    stFinalScript += stWeaponsScript;

    //Global ranking treatment
    mFinalKills.forEach((value, key) => {
        if (!mGlogalRanking.has(key)) {
            mGlogalRanking.set(key, value);
        }
        else {
            mGlogalRanking.set(key, mGlogalRanking.get(key) + mFinalKills.get(key));
        }
    });

    mGlogalRankingSort = new Map([...mGlogalRanking.entries()].sort((a, b) => b[1] - a[1]));

    return stFinalScript;
}

module.exports = { parserData }