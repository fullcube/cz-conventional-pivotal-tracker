"format cjs"

const findConfig = require('find-config')
const wrap = require('word-wrap')
const types = require('conventional-commit-types').types
const padend = require('lodash.padend')
const startsWith = require('lodash.startswith')
const git = require('git-rev')

function readConfigFile() {
  // Try to find config block in the nearest package.json
  var pkg = findConfig.require('package.json', {home: false})
  if (pkg) {
    const pkgName = 'cz-conventional-pivotal-tracker'
    if (pkg.config && pkg.config[pkgName] && pkg.config[pkgName].config) {
      var config = pkg.config[pkgName].config

      console.info('>>> Using cz-customizable config specified in your package.json')

      return config
    }
  }
}

function getTypes(config) {
  const choices = []
  Object.keys(types).forEach(type => {
    choices.push({
      name: `${padend(type+':', 10)} ${types[type].description}`,
      value: type,
    })
  })
  return choices
}

function getScopes(config) {
  return config && config.scopes || []
}

function getPivotalTrackerId(cb) {
  git.branch(function (str) {
    const parts = str.split('-')
    const storyId = parts[parts.length - 1]
    cb(`#${storyId}`)
  })
}
// This can be any kind of SystemJS compatible module.
// We use Commonjs here, but ES6 or AMD would do just
// fine.
module.exports = {

  // When a user runs `git cz`, prompter will
  // be executed. We pass you cz, which currently
  // is just an instance of inquirer.js. Using
  // this you can ask questions and get answers.
  //
  // The commit callback should be executed when
  // you're ready to send back a commit template
  // to git.
  //
  // By default, we'll de-indent your commit
  // template and will keep empty lines.
  prompter: function(cz, commit) {
    var config = readConfigFile()
    console.log(config)
    console.log('\nLine 1 will be cropped at 100 characters. All other lines will be wrapped after 100 characters.\n')

    getPivotalTrackerId(function(storyId) {
      // Let's ask some questions of the user
      // so that we can populate our commit
      // template.
      //
      // See inquirer.js docs for specifics.
      // You can also opt to use another input
      // collection library if you prefer.
      cz.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Select the type of change that you\'re committing:',
          choices: getTypes(config),
        }, {
          type: 'list',
          name: 'scope',
          message: 'Denote the scope of this change (devops, app, server, etc.):',
          choices: getScopes(config).concat([
            new cz.Separator(),
            { name: 'empty', value: false },
            { name: 'custom', value: 'custom' },
          ]),
          when: function(answers) {
            return getScopes(config).length
          }
        }, {
          type: 'input',
          name: 'scope',
          message: 'Denote the SCOPE of this change:',
          when: function(answers) {
            return !getScopes(config).length || answers.scope === 'custom'
          }
        }, {
          type: 'input',
          name: 'subject',
          message: 'Write a short, imperative tense description of the change:\n'
        }, {
          type: 'input',
          name: 'body',
          message: 'Provide a longer description of the change:\n'
        }, {
          type: 'input',
          name: 'footer',
          message: 'List any breaking changes:\n'
        }, {
          type: 'input',
          name: 'story',
          message: 'Pivotal Tracker Story ID:\n',
          default: storyId,
          validate: function(input) {
            if (input && !startsWith(input, '\#')) {
              return 'Pivotal Tracker Story ID must start with \'#\'';
            } else {
              return true;
            }
          }
        }, {
          type: 'list',
          name: 'workflow',
          message: 'Workflow command (testing, closed, etc.) (optional):\n',
          choices: [
            {name: 'Finishes'},
            {name: 'Fixes'},
            {name: 'Delivers'},
            new cz.Separator(),
            { name: 'none', value: false },
          ],
          when: function(answers) {
            return answers.story
          }
        }
      ]).then(function(answers) {

        var maxLineWidth = 100
        var headTrimLength = maxLineWidth

        var wrapOptions = {
          trim: true,
          newline: '\n',
          indent:'',
          width: maxLineWidth
        }

        // parentheses are only needed when a scope is present.
        var scope = answers.scope.trim()
        scope = scope ? '(' + answers.scope.trim() + ')' : ''

        // Hard limit this line
        var subject = answers.type + scope + ': ' + answers.subject.trim()
        var pt = ''

        // Add the story Pivotal Tracker story ID.
        if (answers.story) {
          const workflow = answers.workflow ? `${answers.workflow} ` : ''
          pt = ` [${workflow}${answers.story}]`
          headTrimLength = maxLineWidth - pt.length
        }

        // Hard limit this line.
        var head = (subject).slice(0, headTrimLength) + pt

        // Wrap these lines at 100 characters.
        var body = wrap(answers.body, wrapOptions)
        var footer = wrap(answers.footer, wrapOptions)

        commit(head + '\n\n' + body + '\n\n' + footer)
      })
    })
  }
}
