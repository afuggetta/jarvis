var express = require('express');
var app = express();
var Botkit = require('botkit');
var request = require('request');


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
        console.log('Error: Specify token in environment');
        process.exit(1);
    }

    var url = "https://api.github.com";

    bot.reply(message, 'Forking the repo...');
    request(
        {
            method: 'POST',
            uri: url + '/repos/' + repo + '/forks',
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
                                'fallback': 'To be useful, I need you to invite me in a channel.',
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

                        convo.ask('Please specify the organization:', [
                                {
                                    default: true,
                                    callback: function (response, convo) {
                                        if (response) {
                                            var github_url = "https://api.github.com",
                                                api_url = github_url + '/orgs/' + response.text + '/repos';
                                            convo.say('Listing projects...');
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

                        convo.ask('Please specify the project URL:', [
                                {
                                    default: true,
                                    callback: function (response, convo) {
                                        if (response) {
                                            var api_url = response.text + '/api/v3/projects';
                                            convo.say('Listing projects...');
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
