# Internationalization and Localization

## formatjs

For the provider app we use [FormatJS](https://formatjs.io/) directly through a small
Handlebars adapter in `src/js/i18n/intl.js`. Our translation will be key based and found
under [`src/js/i18n/en-US`](https://github.com/RoundingWell/app-frontend/tree/develop/src/js/i18n/en-US).

Locale files are divided by stable production ownership:

- `clinicians.yml`, `dashboards.yml`, `globals.yml`, `patients.yml`, and `programs.yml`
  correspond to the app ownership roots.
- `shared.yml` contains cross-domain UI infrastructure, including the existing
  `components`, `regions`, and `shared` key namespaces. It also retains the root-level
  `locales` metadata used by the runtime and PhraseApp upload.
- Every top-level namespace under `careOptsFrontend` must belong to exactly one file. The
  locale composer rejects duplicate namespaces instead of silently replacing one tree.
- Patient form translations live in `patients.yml` with the rest of the patient-owned
  interface.

File placement and key paths follow stable product ownership, but do not need to mirror
every physical directory segment. Moving a module alone does not justify renaming its
translation keys. When product ownership intentionally changes, move the translation key
and all consumers together. New keys should use the nearest stable product namespace,
followed by the module, view or template, and a contextual string name.

Describe what the string is doing in context, not only what it says. For example, use
`saveButtonText` rather than `save` when the shorter name would be ambiguous.

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
When uploading changed files from `src/js/i18n/en-US` to PhraseApp:
1. Select "Symfony YAML (.yml)" as the format (*not the beta version)
2. Select "Use existing local" and "en-US"

Any file with changed or added strings must be uploaded to PhraseApp. **Important:**
Whenever locale files are uploaded to PhraseApp, the branch containing the changes must
also be deployed to translate.roundingwell.com.

When existing strings have been modified, you'll need to tell PhraseApp to update all existing translations by checking "Update translations" when uploading the YAML file.

Once the changed YAML files have been uploaded, PhraseApp should display that the English
locale has 0 untranslated keys. If it says there are untranslated keys, review the YAML
changes to ensure nothing is incorrect. It will also display any keys that have been
removed. Delete those unused keys.

Strings with complex logic such as the use of `select`s or nested logic may require extra clarification in the comments for that individual string. Go to Locales > en-US, and search for the string. Click the Comments tab to add further explanation.
