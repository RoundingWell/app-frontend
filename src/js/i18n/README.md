# Internationalization and Localization

## formatjs

For the provider app we are using Yahoo's [formatjs](https://formatjs.io/) through the
[handlebars-intl](https://formatjs.io/handlebars/) lib. Our translation will be key based
and found in the directory [`/assets/js/i18n`](https://github.com/RoundingWell/app-frontend/tree/develop/src/js/i18n).

The key naming strategy currently under consideration is:
`view.directory.fileViews.viewName.stringContextName` where the first part is the
the directory of the view file or template delimited by "." followed by a camelCased version
of the file in that directory; followed by a camelCased version of the ViewClass (if for a view);
followed by the camelCased string contextual name. We should attempt to describe what the string
is _doing_ in context, not what the text necessarily _says_. IE perhaps the text string we are
replacing is "Save". Rather than name the context name it could be saveLabel (or just label
if the View name is particularly descriptive.) This way the key is not ambiguous as far as,
"Is it for the button or the label?" etc.

Considering the following hypothetical locale example:
```json
{
  "locales": "en-US",
  "globals": {
    "headerViews": {
      "titleView": {
        "welcomeText": "Welcome to our site!"
      }
    }
  }
}
```

There are 3 methods for accessing i18n strings. Primarily we will want to access strings via handlebars.
If not using a specific formatjs helper (for pluralization for instance) intl information can be accessed
via handlebars "@data" interface such that:
```hbs
<h1>{{ @intl.globals.headerViews.titleView.welcomeText }} | {{ today }}</h1>
```

Handlebars templates rendered via a Marionette.View will automatically render with intl data.
For scenarios in which case we want to render a handlebars template inline we will need another renderer:
```js
import { renderTemplate } from 'js/i18n';

const SomeTemplate = hbs`<h1>{{ @intl.globals.headerViews.titleView.welcomeText }} | {{ today }}</h1>`;

const someHtmlString = renderTemplate(SomeTemplate, { today: dayjs().format('l') });

// someHtmlString will be "<h1>Welcome to our site! | January 1, 2020</h1>"
```

Additionally there will be some instances where we want a localized string in js directly:
```js
import intl from 'js/i18n';

const myModel = new Backbone.Model({
    title: intl.globals.headerView.titleView.welcomeText
});

myModel.get('title'); // "Welcome to our site!"
```

One additional note: When using a key with a formatjs interface `intl` would not be included.
```hbs
<span class="inbox_count">{{formatMessage (intlGet "globals.someView.inboxCount")
                            count = inbox_count }}</span>
```

Strings that contain html will be postfixed with `HTML` on the key name. The key will then need to be referenced in the template with either `{{{ }}}` or `{{formatHTMLMessage}}`. For example:
```json
{
  "locales": "en-US",
  "globals": {
    "headerViews": {
      "titleView": {
        "welcomeTextHTML": "<strong>Welcome to our site!<strong> Enjoy your stay."
      }
    },
    "footerViews": {
        "signatureView": {
            "goodbyeTextHTML": "<strong>Goodbye,</strong> { username }"
        }
    }
  }
}
```
```hbs
{{{ @intl.globals.headerView.titleView.welcomeTextHTML }}}
{{formatHTMLMessage (intlGet "globals.footerViews.signatureView.goodbyeTextHTML") username=user_name }}
```

Also note that for now we'll be using dayjs and not formatjs for date and time formatting.


## dayjs.js

dayjs on the app is loaded via vite. Currently we are including all supported locales
in the same bundle.

**If a new locale is added, it will need to be imported into i18n/index.js.**

Additionally we'll be using `format('l')` style localized formats whenever possible.
See "Localized Formats" at [day.js.org](https://day.js.org/docs/en/display/format#localized-formats)

## [PhraseApp](https://phraseapp.com)
When uploading a new version of en-US.yml to PhraseApp:
1. Select "Symfony YAML (.yml)" as the format (*not the beta version)
2. Select "Use existing local" and "en-US"

Any time strings are changed or added to the YAML file, it must be uploaded to PhraseApp. **Important:** Whenever the file is uploaded to PhraseApp, the branch containing the changes must also be deployed to translate.roundingwell.com.

When existing strings have been modified, you'll need to tell PhraseApp to update all existing translations by checking "Update translations" when uploading the YAML file.

Once the YAML file has been uploaded, PhraseApp should display that the English locale has 0 untranslated keys. If it says there are untranslated keys, review the YAML changes to ensure nothing is incorrect. It will also display any keys that have been removed. Delete those unused keys.

Strings with complex logic such as the use of `select`s or nested logic may require extra clarification in the comments for that individual string. Go to Locales > en-US, and search for the string. Click the Comments tab to add further explanation.
