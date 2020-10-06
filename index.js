fs = require('fs')
parser_functions = require('./parser_functions')

fs.readFile('./log/qgames.log', 'utf8', function (err, data) {
    const dir = './output';

    if (err) {
        return console.log(err);
    }
    else {

        if (!fs.existsSync(dir)) {
            fs.mkdir(dir, function(err) {
                if (err) {
                    return console.log(err)
                }
            })
        }

        fs.writeFile('./output/quake_report.txt', parser_functions.parserData(data), function (err) {
            if (err) {
                return console.log(err);
            }
            else {
                console.log('Report was generated with sucess!');
            }
        });
    }
})
