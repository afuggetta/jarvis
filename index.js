var express = require('express');
var app = express();
var Botkit = require('botkit');
var request = require('request');
var github_api_url = "https://api.github.com";


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function (request, response) {
    response.render('pages/index');
});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});

var controller = Botkit.slackbot({
    debug: false
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

controller.hears('fork (.*)', 'direct_message,direct_mention,mention', function (bot, message) {

    var repo = message.match[1];

    if (!repo) {
        return bot.reply(message, 'Hmmm, you haven\'t passed any repo to fork.');
    }

    if (!process.env.githubtoken) {
        bot.reply(message, 'Error: No token specified');
        // process.exit(1);
        convo.next();
    }

    bot.reply(message, 'Forking the repo...');
    request(
        {
            method: 'POST',
            uri: github_api_url + '/repos/' + repo + '/forks',
            headers: {
                Authorization: 'token ' + process.env.githubtoken,
                'content-type': 'application/json',
                'User-Agent': 'ndevr-deploy'
            }
        },
        function (error, response, body) {
            if (!error && ( response.statusCode == 200 || response.statusCode == 202 )) {
                console.log(response);

                body = JSON.parse(body);

                bot.reply(message,
                    {
                        'attachments': [
                            {
                                'fallback': repo + ' forked!',
                                'title': repo + ' forked!',
                                'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                'color': '#7CD197'
                            }
                        ]
                    }
                );

            }
            else {
                bot.reply(message,
                    {
                        'attachments': [
                            {
                                'fallback': 'Error...',
                                'title': 'There was an error while forking the repo',
                                'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                'color': '#FF0000'
                            }
                        ]
                    }
                );
            }
        }
    );


});

controller.hears('who am i?', 'direct_message,direct_mention,mention', function (bot, message) {
    bot.api.users.info({user: message.user}, function (err, info) {
        bot.reply(message, info.user.name);
    });
});

controller.hears('what day is it?', 'direct_message,direct_mention,mention', function (bot, message) {
    var date = new Date();
    var numberOfTheDay = date.getDay();
    var weekday = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    var n = weekday[numberOfTheDay];

    switch (n) {
        case 'Friday':
            bot.reply(message, 'It\'s Monday, have a great weekend!');
            break;
        case 'Wednesday':
            bot.reply(message, 'It\'s Mike Mike Mike Mike Mike day!');
            break;
        default:
            bot.reply(message, 'It\'s ' + n + '!');
            break;
    }
});

controller.hears(['send me some money', 'give me money'],
    'direct_message,direct_mention,mention', function (bot, message) {
        bot.api.users.info({user: message.user}, function (err, info) {
            if (!err) {
                var name = info.user.name;
                if (info.user.profile.first_name) {
                    name = info.user.profile.first_name;
                }
                bot.reply(message, 'Sure, ' + name + '. Give me your bank details :troll: ...');
            }
        });
    }
);

controller.hears(['are you done yet', 'is it done yet'], 'direct_message,direct_mention,mention', function (bot, message) {
        bot.api.users.info({user: message.user}, function (err, info) {
            if (!err) {
                bot.reply(message, 'I am groot!');
            }
        });
    }
);

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function (bot, message) {
        function formatUptime(uptime) {
            var unit = 'second';
            if (uptime > 60) {
                uptime = uptime / 60;
                unit = 'minute';
            }
            if (uptime > 60) {
                uptime = uptime / 60;
                unit = 'hour';
            }
            if (uptime != 1) {
                unit = unit + 's';
            }

            uptime = uptime + ' ' + unit;
            return uptime;
        }

        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
            '>. I have been running for ' + uptime + '.');

    }
);


controller.hears(['List projects', 'List available projects', 'List repos', 'List repositories'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.startConversation(message, function (err, convo) {
        if (!err) {
            convo.ask('What version control system? [GitHub, GitLab]?', [
                {
                    pattern: 'GitHub',
                    callback: function (response, convo) {
                        if (!process.env.githubtoken) {
                            bot.reply(message, 'Error: No token specified');
                            // process.exit(1);
                            convo.next();
                        }

                        convo.ask('Please specify the organization:',
                            [
                                {
                                    default: true,
                                    callback: function (response, convo) {
                                        if (response) {
                                            var api_url = github_api_url + '/orgs/' + response.text + '/repos';
                                            request(
                                                {
                                                    method: 'GET',
                                                    uri: api_url,
                                                    headers: {
                                                        Authorization: 'token ' + process.env.githubtoken,
                                                        'content-type': 'application/json',
                                                        'User-Agent': 'ndevr-deploy'
                                                    }
                                                },
                                                function (error, response, body) {
                                                    if (!error && ( response.statusCode == 200 || response.statusCode == 202 )) {
                                                        var projects = JSON.parse(body);

                                                        if (0 == projects.length) {
                                                            convo.say('No projects in the URL');
                                                        } else {
                                                            var fields = [],
                                                                temp;
                                                            for (var i = 0; i < projects.length; i++) {
                                                                temp = {
                                                                    "title": "ID: " + projects[i].id,
                                                                    "value": projects[i].full_name,
                                                                    "short": false
                                                                };
                                                                fields.push(temp);
                                                            }
                                                            var attachments = {
                                                                "attachments": [
                                                                    {
                                                                        "fallback": "Repositories",
                                                                        "color": "#36a64f",
                                                                        "title": "Repositories",
                                                                        "fields": fields
                                                                    }
                                                                ]
                                                            };
                                                            bot.reply(message, attachments);
                                                        }
                                                        convo.next();

                                                    }
                                                    else {
                                                        bot.reply(message,
                                                            {
                                                                'attachments': [
                                                                    {
                                                                        'fallback': 'Error...',
                                                                        'title': 'There was an error while listing the repositories',
                                                                        'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                                                        'color': '#FF0000'
                                                                    }
                                                                ]
                                                            }
                                                        );
                                                    }
                                                }
                                            );
                                        }
                                        convo.next();
                                    }
                                }
                            ]
                        );
                        convo.next();
                    }
                },
                {
                    pattern: 'GitLab',
                    callback: function (response, convo) {
                        if (!process.env.gitlab_token) {
                            bot.reply(message, 'Error: No token specified');
                            // process.exit(1);
                            convo.next();
                        }

                        convo.ask('Please specify the project URL:',
                            [
                                {
                                    default: true,
                                    callback: function (response, convo) {
                                        if (response) {
                                            var api_url = response.text.slice(1, -1) + '/api/v3/projects';
                                            request(
                                                {
                                                    method: 'GET',
                                                    uri: api_url,
                                                    headers: {
                                                        'PRIVATE-TOKEN': process.env.gitlab_token
                                                    }
                                                },
                                                function (error, response, body) {
                                                    if (!error && response.statusCode == 200) {
                                                        var projects = JSON.parse(body);

                                                        if (0 == projects.length) {
                                                            convo.say('No projects in the URL');
                                                        } else {
                                                            var fields = [],
                                                                temp;
                                                            for (var i = 0; i < projects.length; i++) {
                                                                temp = {
                                                                    "title": "ID: " + projects[i].id,
                                                                    "value": projects[i].path_with_namespace,
                                                                    "short": false
                                                                };
                                                                fields.push(temp);
                                                            }
                                                            var attachments = {
                                                                "attachments": [
                                                                    {
                                                                        "fallback": "Repositories",
                                                                        "color": "#36a64f",
                                                                        "title": "Repositories",
                                                                        "fields": fields
                                                                    }
                                                                ]
                                                            };
                                                            bot.reply(message, attachments);
                                                        }
                                                        convo.next();
                                                    }
                                                    else {
                                                        bot.reply(message,
                                                            {
                                                                'attachments': [
                                                                    {
                                                                        'fallback': 'Error...',
                                                                        'title': 'There was an error while listing the repositories',
                                                                        'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                                                        'color': '#FF0000'
                                                                    }
                                                                ]
                                                            }
                                                        );
                                                    }
                                                }
                                            );
                                        }
                                        convo.next();
                                    }
                                }
                            ]
                        );
                        convo.next();
                    }
                },
                {
                    pattern: 'quit',
                    callback: function (response, convo) {
                        convo.say('Perhaps later.');
                        // do something else...
                        convo.next();
                    }
                },
                {
                    default: true,
                    callback: function (response, convo) {
                        // just repeat the question
                        convo.repeat();
                        convo.next();
                    }
                }
            ]);

        }
    });

});

/**
 * Example: @jarvis deploy ndevrinc/internet-retailer to deploy-test -  @jarvis deploy ndevrinc/internet-retailer to deploy-live
 *
 * It will check your slack associated email against the hardcoded array of allowed users (we can think of something else)
 * Will ask for a confirmation and, if confirmed, will call GitHub API creating a Pull request first and then merging it.
 * This will trigger codeship to deploy to Pantheon.
 *
 */
controller.hears('deploy (.*) from (.*) to (.*)', 'direct_message,direct_mention,mention', function (bot, message) {

    var sourceRepo = message.match[1],
        headBranch = message.match[2],
        baseBranch = message.match[3],
        allowedBaseBranches = ['deploy-test', 'deploy-live'],
        allowedUsers = ['mdorman@ndevr.io', 'matthewdorman@gmail.com', 'mhwang@ndevr.io', 'meekyhwang@gmail.com', 'mcallari@ndevr.io', 'afuggetta@ndevr.io'];

    if (!baseBranch.indexOf(allowedBaseBranches)) {
        return bot.reply(message, 'I\'m sorry, Dave. I\'m afraid I can\'t do that.');
    }

    bot.api.users.info({user: message.user}, function (err, info) {
        if (-1 === allowedUsers.indexOf(info.user.profile.email)) {
            bot.reply(message, 'You shall not pass!!!');
        } else if (!process.env.githubtoken) {
            bot.reply(message, 'Error: No token specified');
        } else {
            bot.startConversation(message, function (err, convo) {
                if (!err) {
                    convo.ask('Are you sure you want to deploy ' + sourceRepo + ' from ' + headBranch + ' to ' + baseBranch + '?', [
                        {
                            pattern: 'done',
                            callback: function (response, convo) {
                                convo.say('OK you are done!');
                                convo.next();
                            }
                        },
                        {
                            pattern: bot.utterances.yes,
                            callback: function (response, convo) {
                                request.post(
                                    {
                                        url: github_api_url + '/repos/' + sourceRepo + '/pulls',
                                        headers: {
                                            Authorization: 'token ' + process.env.githubtoken,
                                            'cache-control': 'no-cache',
                                            'content-type': 'application/json',
                                            'User-Agent': 'ndevr-deploy'
                                        },
                                        json: {
                                            "title": "Deploying to " + baseBranch,
                                            "body": "This is an automated pull request from Jarvis Slack Bot",
                                            "head": headBranch,
                                            "base": baseBranch
                                        }
                                    },
                                    function (err, response, body) {
                                        if (!err && response.statusCode == 201) {

                                            var pr_number = body.number,
                                                pr_sha = body.head.sha;

                                            request(
                                                {
                                                    method: "PUT",
                                                    url: github_api_url + '/repos/' + sourceRepo + '/pulls/' + pr_number + '/merge',
                                                    headers: {
                                                        Authorization: 'token ' + process.env.githubtoken,
                                                        'cache-control': 'no-cache',
                                                        'content-type': 'application/json',
                                                        'User-Agent': 'ndevr-deploy'
                                                    },
                                                    json: {
                                                        "commit_message": "Jarvis is merging the pull request.",
                                                        "sha": pr_sha
                                                    }
                                                },
                                                function (err, response, body) {
                                                    if (!err && response.statusCode == 200) {

                                                        var attachments = {
                                                            "attachments": [
                                                                {
                                                                    "fallback": "Merged into " + baseBranch,
                                                                    "color": "#36a64f",
                                                                    "title": "Merged into " + baseBranch,
                                                                    "fields": [
                                                                        {
                                                                            "title": "Response",
                                                                            "value": body.message,
                                                                            "short": false
                                                                        }
                                                                    ]
                                                                }
                                                            ]
                                                        };
                                                        bot.reply(message, attachments);

                                                        convo.next();
                                                    } else {
                                                        bot.reply(message,
                                                            {
                                                                'attachments': [
                                                                    {
                                                                        'fallback': 'Error...',
                                                                        'title': 'There was an error while merging the pull request:',
                                                                        'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                                                        'color': '#FF0000'
                                                                    }
                                                                ]
                                                            }
                                                        );
                                                    }

                                                }
                                            );

                                            convo.next();
                                        } else {
                                            bot.reply(message,
                                                {
                                                    'attachments': [
                                                        {
                                                            'fallback': 'Error...',
                                                            'title': 'There was an error while creating a pull request:',
                                                            'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                                            'color': '#FF0000'
                                                        }
                                                    ]
                                                }
                                            );
                                        }

                                    }
                                );
                            }
                        },
                        {
                            pattern: bot.utterances.no,
                            callback: function (response, convo) {
                                convo.say('Perhaps later.');
                                // do something else...
                                convo.next();
                            }
                        },
                        {
                            default: true,
                            callback: function (response, convo) {
                                // just repeat the question
                                convo.repeat();
                                convo.next();
                            }
                        }
                    ]);

                }
            });
        }
    });

});

/**
 * Example: @jarvis deploy ndevrinc/internet-retailer to deploy-test -  @jarvis deploy ndevrinc/internet-retailer to deploy-live
 *
 * It will check your slack associated email against the hardcoded array of allowed users (we can think of something else)
 * Will ask for a confirmation and, if confirmed, will call GitHub API creating a Pull request first and then merging it.
 * This will trigger codeship to deploy to Pantheon.
 *
 */
controller.hears('merge pr (.*) from (.*) sha (.*)', 'direct_message,direct_mention,mention', function (bot, message) {

    var allowedUsers = ['mdorman@ndevr.io', 'matthewdorman@gmail.com', 'mhwang@ndevr.io', 'meekyhwang@gmail.com', 'mcallari@ndevr.io', 'afuggetta@ndevr.io'];

    bot.api.users.info({user: message.user}, function (err, info) {
        if (-1 === allowedUsers.indexOf(info.user.profile.email)) {
            bot.reply(message, 'You shall not pass!!!');
        } else if (!process.env.githubtoken) {
            bot.reply(message, 'Error: No token specified');
        } else {
            bot.startConversation(message, function (err, convo) {
                if (!err) {
                    convo.ask('Are you sure you want to merge?', [
                        {
                            pattern: 'done',
                            callback: function (response, convo) {
                                convo.say('OK you are done!');
                                convo.next();
                            }
                        },
                        {
                            pattern: bot.utterances.yes,
                            callback: function (response, convo) {
                                request(
                                    {
                                        method: "PUT",
                                        url: github_api_url + '/repos/' + message.match[2] + '/pulls/' + message.match[1] + '/merge',
                                        headers: {
                                            Authorization: 'token ' + process.env.githubtoken,
                                            'cache-control': 'no-cache',
                                            'content-type': 'application/json',
                                            'User-Agent': 'ndevr-deploy'
                                        },
                                        json: {
                                            "commit_message": "Jarvis is merging the pull request.",
                                            "sha": message.match[3]
                                        }
                                    },
                                    function (err, response, body) {
                                        if (!err && response.statusCode == 200) {

                                            var attachments = {
                                                "attachments": [
                                                    {
                                                        "fallback": "PR Merged",
                                                        "color": "#36a64f",
                                                        "title": "PR Merged",
                                                        "fields": [
                                                            {
                                                                "title": "Response",
                                                                "value": body.message,
                                                                "short": false
                                                            }
                                                        ]
                                                    }
                                                ]
                                            };
                                            bot.reply(message, attachments);

                                            convo.next();
                                        } else {
                                            bot.reply(message,
                                                {
                                                    'attachments': [
                                                        {
                                                            'fallback': 'Error...',
                                                            'title': 'There was an error while merging the pull request:',
                                                            'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                                            'color': '#FF0000'
                                                        }
                                                    ]
                                                }
                                            );
                                        }

                                    }
                                );

                                convo.next();
                            }
                        },
                        {
                            pattern: bot.utterances.no,
                            callback: function (response, convo) {
                                convo.say('Perhaps later.');
                                // do something else...
                                convo.next();
                            }
                        },
                        {
                            default: true,
                            callback: function (response, convo) {
                                // just repeat the question
                                convo.repeat();
                                convo.next();
                            }
                        }
                    ]);

                }
            });
        }
    });

});

controller.hears(['Get GitHub API rates'], 'direct_message,direct_mention,mention', function (bot, message) {
    var api_url = github_api_url + '/rate_limit';
    request(
        {
            method: 'GET',
            url: api_url,
            headers: {
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'user-agent': 'ndevr-deploy',
                authorization: 'token ' + process.env.githubtoken
            }
        },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var rates = JSON.parse(body);

                if (0 == rates.length) {
                    convo.say('No rates found');
                } else {

                    var attachments = {
                        "attachments": [
                            {
                                "fallback": "Rates",
                                "color": "#36a64f",
                                "title": "Rates",
                                'text': 'Limit: ' + rates.rate.limit + '.\nRemaining: ' + rates.rate.remaining + '.\nReset: ' + rates.rate.reset
                            }
                        ]
                    };
                    bot.reply(message, attachments);
                }
            }
            else {
                bot.reply(message,
                    {
                        'attachments': [
                            {
                                'fallback': 'Error...',
                                'title': 'There was an error while listing the rates',
                                'text': 'Status code: ' + response.statusCode + '.\nStatus message: ' + response.statusMessage,
                                'color': '#FF0000'
                            }
                        ]
                    }
                );
            }
        }
    );
});
