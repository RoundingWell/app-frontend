# Widgets

## Defined Widgets

All available widget types are currently located in the [widgets file](https://github.com/RoundingWell/app-frontend/blob/develop/src/js/apps/patients/shared/widgets/widgets.js)

Most are hardcoded such as `dob` which formats and displays the patient's Date of Birth

## DEPRECATIONS

All Custom Widgets have been deprecated

Widget definition `field_name` has been deprecated for `key`.

The following examples are equivalent:
```json
{
  "display_name": "Example Widget",
  "key": "foo",
}
```

Deprecated:
```json
{
  "display_name": "Example Widget",
  "field_name": "foo"
}
```

The follow nested examples are equivalent:
```json
{
  "display_name": "Example Widget",
  "key": "foo.nested.value"
}
```

Deprecated:
```json
{
  "display_name": "Example Widget",
  "field_name": "foo",
  "key": "nested.value"
}
```

## Main Widget

The main widget supports the optional `display_name` and a handlebars `template`.  Frontend handlebars helpers are available.

The `values` of the widget inform the backend as to what data to provide to the widget. Reference backend documentation for current options.

```json
{
  "id": "<uuid>",
  "type": "widgets",
  "attributes": {
    "category": "widget",
    "slug": "template",
    "name": "Name for Organization",
    "definition": {
      "template": "<hr><div>{{far 'calendar-days'}}Sex: <b>{{ sex }}</b></div><hr>",
      "display_name": "Optional Label"
    },
    "values": {
      "sex": "@patient.sex"
    }
  }
}
```

---

## Customizing the Wrapper Template

By default, all widgets will use the following template to "wrap" the contents from a widget:

```hbs
{{~#if definition.display_name}}<div class="widgets__heading">{{ definition.display_name }}</div>{{/if~}}
<div class="widgets__item" data-content-region></div>
```

You can override this in `definition.wrapperTemplate` as long as you **include** a `<div data-content-region>` element. This region is where the widget’s main content (from `template`) will render.

Below is an example of a more advanced wrapper template:

```json
{
  "id": "<uuid>",
  "type": "widgets",
  "attributes": {
    "category": "widget",
    "slug": "template",
    "name": "Custom Wrapper Example",
    "definition": {
      "template": "<div>{{ someValue }}</div>",
      "display_name": "My Custom Wrapper",
      "wrapperTemplate": "{{#if someValue}}{{#if definition.display_name}}<h2>{{ definition.display_name }}</h2>{{/if}}<div data-content-region></div></div>{{else}}If no content this widget should be display:none{{/if}}"
    },
    "values": {
      "someValue": "@patient.someValue"
    }
  }
}
```

#### Notes on Custom Wrapper Usage

- **`<div data-content-region>`**: This is required. If you remove or rename it, the widget's main content will not render. However, any remaining wrapper HTML will still appear.
- **Conditional Rendering**: The above example shows how you might conditionally display content based on the existence of `someValue`. If `someValue` is not set or returned from the backend, the template will render different HTML.
- **Hiding the widget** if the template renders "" it should apply `display:none`

## Hardcoded Widgets

* dob
* sex
* status
* divider
* workspaces

### Form Widget

For displaying a standalone form in a widget area. Example:
```json
{
  "category": "formWidget",
  "definition": {
    "display_name": "Form",
    "form_id": "1",
    "form_name": "Test Form",
    "is_modal": true,
    "modal_size": "small"
  }
}
```

`is_modal` will display the form in a modal instead of the form page.
`modal_size: small` uses the small modal. Any other value, including an omitted `modal_size`, uses the large modal. Set `is_modal` to `false` to navigate to the patient form page instead.

## Custom Widgets (DEPRECATED)

Custom widgets all support `default_html`. If supplied the `default_html` will display when the selected field is null/empty, allowing for a custom message (such as `<i>No Phone Number Available</i>`)

### Patient Identifier Widget

This widget displays a patient identifier value (such as a MRN or SSN number).

As an example, this is how you'd display a patient's MRN number:

```json
{
  "category": "patientIdentifiers",
  "definition": {
    "default_html": "Not Found",
    "display_name": "MRN Number",
    "identifier_type": "mrn"
  }
}
```

This would display:

```
MRN Number
A5432112345
```

If the patient identifier is null/empty, the `default_html` value will display instead. Using the example above, it would display `Not found`.

```
MRN Number
Not Found
```

If the patient identifier is null/empty and no `default_html` value is supplied, a dash (`-`) will be shown.

```
MRN Number
-
```
