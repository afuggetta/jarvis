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

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.listen(app.get('port'), function() {
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

  var url = "https://api.github.com";

  bot.reply(message, 'Forking the repo...');
  request(
      {
        method: 'POST',
        uri: url + '/repos/' + repo + '/forks',
        headers: {
          Authorization: 'token ca52cd93d6f7e66ed81d264bb89a19be8cfd71db',
          'content-type': 'application/json',
          'User-Agent': 'ndevr-deploy'
        }
      },
      function (error, response, body) {
        if (!error && ( response.statusCode == 200 || response.statusCode == 202 ) ) {
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