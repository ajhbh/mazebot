const request = require('request');

const urlroot = 'https://api.noopschallenge.com';
var urlcurrent = '/mazebot/race/start';
//var urlcurrent = '/mazebot/random?minSize=10&maxSize=20';;

var exampleMazeResponse = {
    "name": "Maze #236 (10x10)",
    "mazePath": "/mazebot/mazes/ikTcNQMwKhux3bWjV3SSYKfyaVHcL0FXsvbwVGk5ns8",
    "startingPosition": [4, 3],
    "endingPosition": [3, 6],
    "message": "When you have figured out the solution, post it back to this url. See the exampleSolution for more information.",
    "exampleSolution": {
        "directions": "ENWNNENWNNS"
    },
    "map": [
        [" ", " ", "X", " ", " ", " ", "X", " ", "X", "X"],
        [" ", "X", " ", " ", " ", " ", " ", " ", " ", " "],
        [" ", "X", " ", "X", "X", "X", "X", "X", "X", " "],
        [" ", "X", " ", " ", "A", " ", " ", " ", "X", " "],
        [" ", "X", "X", "X", "X", "X", "X", "X", " ", " "],
        ["X", " ", " ", " ", "X", " ", " ", " ", "X", " "],
        [" ", " ", "X", "B", "X", " ", "X", " ", "X", " "],
        [" ", " ", "X", " ", "X", " ", "X", " ", " ", " "],
        ["X", " ", "X", "X", "X", "X", "X", " ", "X", "X"],
        ["X", " ", " ", " ", " ", " ", " ", " ", "X", "X"]
    ]
};

// wrap a request in an promise
function getRequest(url) {
    return new Promise((resolve, reject) => {
        request.get(url, (error, response, body) => {
            if (error) reject(error);
            if (response.statusCode != 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            var jsonRespnse = JSON.parse(body);
            resolve(jsonRespnse);
        });
    });
}

function postRequest(url, payloadJson) {
    return new Promise((resolve, reject) => {
        request.post(url, {
            json: payloadJson
        }, function (error, response, body) {
            if (error) reject(error);
            if (response.statusCode != 200) {
                reject('Invalid status code <' + response.statusCode + '>\n' + JSON.stringify(response.body));
            }
            //var jsonRespnse = JSON.parse(body);
            resolve(body);
        });
    });
}

function processMap(map, startposflip, endposflip) {
    return new Promise((resolve, reject) => {
        var startpos = startposflip.reverse();
        var endpos = endposflip.reverse();
        var stepnumber = 0;
        var currentpos = startpos;
        var directionsString = "";
        while (!(currentpos[0] === endpos[0] && currentpos[1] === endpos[1])) {
            var x = currentpos[0];
            var y = currentpos[1];
            var directionsAllowed = directionsAllowedForPos(map, [x, y]);
            if (!directionsAllowed || !directionsAllowed.length) {
                //deadend logic needed
                var directionsAllowedStepCount = directionsAllowedForPosStepcount(map, [x, y]);
                var directionToNextStepCount = directionTowardsHighStepCount(map, [x, y], directionsAllowedStepCount);
                stepnumber++;
                setPositionRuledOut(map, [x, y])
                currentpos = directionToNextStepCount.position;
            } else {
                var directionToEnd = directionTowardsEnd(currentpos, endpos, directionsAllowed);
                setPositionVisited(map, [x, y], stepnumber);
                stepnumber++;
                currentpos = directionToEnd.position;
                if (!(currentpos[0] === endpos[0] && currentpos[1] === endpos[1])) {
                    setPositionVisited(map, [currentpos[0], currentpos[1]], 'n');
                }
            }
            //printMap(map);
            // console.log("Step: " + stepnumber);
        };
        currentpos = startpos;
        while (!(currentpos[0] === endpos[0] && currentpos[1] === endpos[1])) {
            var x = currentpos[0];
            var y = currentpos[1];
            var directionsAllowedStepCount = directionsAllowedForPosStepcount(map, [x, y]);
            var directionToNextStepCount = directionTowardsHighStepCount(map, [x, y], directionsAllowedStepCount);
            directionsString += directionToNextStepCount.direction;
            currentpos = directionToNextStepCount.position;
            //printMap(map, '\n\n');
        }
        resolve(directionsString);
    });
}

function directionTowardsEnd(currentpos, endpos, directionOptions) {
    const x = currentpos[0];
    const y = currentpos[1];
    var directionOptionsPositionsRepo = {
        'N': [x - 1, y],
        'E': [x, y + 1],
        'S': [x + 1, y],
        'W': [x, y - 1]
    };
    const directionOptionsRadiansRepo = {
        'N': 0,
        'E': Math.PI / 2,
        'S': Math.PI,
        'W': Math.PI * 3 / 2
    };
    var directionOptionsAvailable = {};
    directionOptions.forEach(element => {
        directionOptionsAvailable[element] = directionOptionsRadiansRepo[element];
    });

    var eastwards = endpos[1] - currentpos[1];
    var northwards = -(endpos[0] - currentpos[0]);
    //var rawbearing = Math.atan2(eastwards, northwards);
    var bearing = (Math.atan2(eastwards, northwards) + 2 * Math.PI) % (2 * Math.PI);

    var bestdirection = null;
    var bestdirectionName = null;
    for (var key in directionOptionsAvailable) {
        if (bestdirectionName == null) {
            bestdirectionName = key;
            bestdirection = directionOptionsAvailable[key];
            continue
        };
        var bestdirectiondiff = ((Math.abs(bestdirection - bearing) + 2 * Math.PI) % (2 * Math.PI));
        var newdirectiondiff = ((Math.abs(directionOptionsAvailable[key] - bearing) + 2 * Math.PI) % (2 * Math.PI));
        if (bestdirectiondiff - newdirectiondiff > 0) {
            bestdirection = directionOptionsAvailable[key];
            bestdirectionName = key;
        }
    }
    return {
        direction: bestdirectionName,
        position: directionOptionsPositionsRepo[bestdirectionName]
    };
}

function directionsAllowedForPos(map, [x, y]) {
    var directions = ['N', 'E', 'S', 'W'];
    var directionsallowed = [];
    for (direction of directions) {
        var allowed = isDirectionAllowed(map, [x, y], direction);
        if (allowed) {
            directionsallowed.push(direction);
        }
    }
    return directionsallowed;
}

function isDirectionAllowed(map, [x, y], direction) {
    //var position = [x, y];
    var nextPosition = [];
    if (direction == 'N') {
        nextPosition = [x - 1, y];
    } else if (direction == 'E') {
        nextPosition = [x, y + 1];
    } else if (direction == 'S') {
        nextPosition = [x + 1, y];
    } else if (direction == 'W') {
        nextPosition = [x, y - 1];
    }
    if (nextPosition[0] < 0 || nextPosition[1] < 0 || nextPosition[0] >= map.length || nextPosition[1] >= map.length) {
        return false;
    } else {
        return isPositionAllowed(map, [nextPosition[0], nextPosition[1]]);
    }
}

function isPositionAllowed(map, [x, y]) {
    var position = [x, y];
    if (map[x][y] === ' ' || map[x][y] === 'B') {
        return true;
    } else {
        return false;
    }
    //don't consider start or end as allowed as if passing through start you're going the wrong way and the end is the end and so is required and has it's own function.
}

/* Not really needed as am comparing current and end position in while loop, 
** and bearing method will mean don't have to explicitly check neighbouring cells for 'B'
function isPositionEnd (map, [x, y]) {
    var position = [x, y];
    if (map[x][y] == 'B') {
        return true;
    } else {
        return false;
    }
}
*/

function setPositionVisited(map, [x, y], stepNumber) {
    map[x][y] = stepNumber;
}

function setPositionRuledOut(map, [x, y]) {
    map[x][y] = 'r';
}

/*
function nextPositionViaStepCount(map, [x, y]) {
    var north = (map[x - 1][y] != undefined ? map[x - 1][y] : null);
    var east = (map[x][y + 1] != undefined ? map[x][y + 1] : null);
    var south = (map[x + 1][y] != undefined ? map[x + 1][y] : null);
    var west = (map[x][y - 1] != undefined ? map[x][y - 1] : null);

    if (north)
        return {
            nextposition: position,
            direction: direction
        };
}
*/

function directionsAllowedForPosStepcount(map, [x, y]) {
    var directions = ['N', 'E', 'S', 'W'];
    var directionsallowed = [];
    for (direction of directions) {
        var allowed = isDirectionAllowedStepCount(map, [x, y], direction);
        if (allowed) {
            directionsallowed.push(direction);
        }
    }
    return directionsallowed;
}

function isDirectionAllowedStepCount(map, [x, y], direction) {
    //var position = [x, y];
    var nextPosition = [];
    if (direction == 'N') {
        nextPosition = [x - 1, y];
    } else if (direction == 'E') {
        nextPosition = [x, y + 1];
    } else if (direction == 'S') {
        nextPosition = [x + 1, y];
    } else if (direction == 'W') {
        nextPosition = [x, y - 1];
    }
    if (nextPosition[0] < 0 || nextPosition[1] < 0 || nextPosition[0] >= map.length || nextPosition[1] >= map.length) {
        return false;
    } else {
        return isPositionAllowedStepCount(map, [nextPosition[0], nextPosition[1]]);
    }
}

function isPositionAllowedStepCount(map, [x, y]) {
    var position = [x, y];
    if (Number.isInteger(map[x][y]) || map[x][y] == 'B') {
        return true;
    } else {
        return false;
    }
    //don't consider start or end as allowed as if passing through start you're going the wrong way and the end is the end and so is required and has it's own function.
}

function directionTowardsHighStepCount(map, [x, y], directionOptions) {
    var directionOptionsPositionsRepo = {
        'N': [x - 1, y],
        'E': [x, y + 1],
        'S': [x + 1, y],
        'W': [x, y - 1]
    };
    var directionOptionsPositions = {};

    directionOptions.forEach(element => {
        directionOptionsPositions[element] = directionOptionsPositionsRepo[element];
    });

    var bestdirection = {};
    var bestdirectionstep = 0;
    for (i in directionOptionsPositions) {
        if (Object.keys(bestdirection).length === 0 && bestdirection.constructor === Object) {
            bestdirection = {
                direction: i,
                position: directionOptionsPositions[i]
            };
            bestdirectionstep = map[directionOptionsPositions[i][0]][directionOptionsPositions[i][1]];
            continue;
        } else if (map[directionOptionsPositions[i][0]][directionOptionsPositions[i][1]] == 'B') {
            bestdirection = {
                direction: i,
                position: directionOptionsPositions[i]
            };
            bestdirectionstep = map[directionOptionsPositions[i][0]][directionOptionsPositions[i][1]];
            continue;
        } else if (map[directionOptionsPositions[i][0]][directionOptionsPositions[i][1]] > bestdirectionstep) {
            bestdirection = {
                direction: i,
                position: directionOptionsPositions[i]
            };
            bestdirectionstep = map[directionOptionsPositions[i][0]][directionOptionsPositions[i][1]];
            continue;
        }
    }
    return bestdirection;
}

function printMap(map) {
    console.log('\n\n');
    for (let i = 0; i < map.length; i++) {
        console.log(map[i].join(' '));
    }
}

// all you need to do is use async functions and await for functions returning promises
async function main() {
    //while (true) {
    var urlrequest = urlroot + urlcurrent;
    console.log(urlrequest);

    try {
        var payloadJson = {
            "login": "ajhbh"
        };
        var response = await postRequest(urlrequest, payloadJson)
        console.log(JSON.stringify(response), '\n');
        if (response.nextMaze != undefined) {
            urlcurrent = response.nextMaze;
        }
        while (true) {
            urlrequest = urlroot + urlcurrent;
            //console.log(urlrequest);
            response = await getRequest(urlrequest);
            // console.log(JSON.stringify(response), '\n');
            //console.log(response.name, response.startingPosition, response.endingPosition);

            if (response.nextMaze != undefined) {
                urlcurrent = response.nextMaze;
            }

            //print map
            var map = response.map;
            //printMap(map);

            //solve map
            var startpos = response.startingPosition;
            var endpos = response.endingPosition;

            var directions = await processMap(map, startpos, endpos);
            console.log("Directions: " + directions);

            payloadJson = {
                "directions": directions
            };
            //send answer back
            urlrequest = urlroot + response.mazePath;
            response = await postRequest(urlrequest, payloadJson);
            console.log(JSON.stringify(response));
            if (response.nextMaze != undefined) {
                urlcurrent = response.nextMaze;
            } else if (response.result == "finished") {
                urlcurrent = response.certificate;
                urlrequest = urlroot + urlcurrent;
                response = await getRequest(urlrequest);
                console.log(JSON.stringify(response), '\n')
                break;
            }
        }
    } catch (error) {
        console.error('ERROR:\n', error);
    }
    //}
}

main();