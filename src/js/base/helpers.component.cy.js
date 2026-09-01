import { View } from 'marionette';

import hbs from 'handlebars-inline-precompile';
import Handlebars from 'handlebars/dist/cjs/handlebars';

import { testTs } from 'helpers/test-timestamp';
import formatDate from 'helpers/format-date';
import { renderTemplate } from 'js/i18n';
import { registerWith } from 'js/i18n/intl';

context('Handlebars helpers', function() {
  specify('Match text formatting', function() {
    const MatchTextView = View.extend({
      template: hbs`
        <div class="test-null">{{matchText "Patient Name" null}}</div>
        <div class="test-match">{{matchText "Patient Name" "Patient"}}</div>
        <div class="test-match-substring">{{matchText "TestPatient Name" "patient" includeSubstrings=true}}</div>
        <div class="test-noescape">{{matchText "<span style='color: green'>Patient</span> Name" "Patient" noEscape=true}}</div>
      `,
    });

    cy
      .mount(() => {
        return new MatchTextView();
      })
      .as('root');

    cy
      .get('@root')
      .find('.test-null strong')
      .should('not.exist');

    cy
      .get('@root')
      .find('.test-match strong')
      .should('contain', 'Patient');

    cy
      .get('@root')
      .find('.test-match-substring strong')
      .should('contain', 'Patient');

    cy
      .get('@root')
      .find('.test-noescape > span strong')
      .should('contain', 'Patient');
  });

  specify('Date time formatting', function() {
    const testDate = testTs();

    const DateTimeView = View.extend({
      template: hbs`
        <div class="test-null">{{formatDateTime null "lll"}}</div>
        <div class="test-date">{{formatDateTime testDate "lll"}}</div>
        <div class="test-nowrap">{{formatDateTime testDate "lll" nowrap=false}}</div>
        <div class="test-default-html">{{formatDateTime null "lll" defaultHtml="No Date Available"}}</div>
      `,
      templateContext() {
        return {
          testDate,
        };
      },
    });

    cy
      .mount(() => {
        return new DateTimeView();
      })
      .as('root');

    cy
      .get('@root')
      .find('.test-null')
      .should('be.empty');

    cy
      .get('@root')
      .find('.test-date')
      .should('contain', formatDate(testDate, 'lll'));

    cy
      .get('@root')
      .find('.test-nowrap')
      .find('.u-text--nowrap')
      .should('not.exist');

    cy
      .get('@root')
      .find('.test-default-html')
      .should('contain', 'No Date Available');
  });

  specify('Intl formatting', function() {
    const testDate = '2026-05-05T12:00:00Z';
    const IntlView = View.extend({
      template: hbs`
        {{#intl formats=formats}}
          <div class="test-date-format">{{formatDate testDate "short"}}</div>
        {{/intl}}
        <div class="test-date-options">{{formatDate testDate year="numeric" month="short" day="numeric" timeZone="UTC"}}</div>
        <div class="test-intlname">{{formatMessage intlName="patients.shared.components.durationComponent.mins" min=4}}</div>
        <div class="test-function">{{formatMessage functionMessage name="Patient"}}</div>
        <div class="test-message">{{formatMessage (intlGet "patients.shared.components.durationComponent.mins") min=2}}</div>
        <div class="test-select">{{formatMessage (intlGet "patients.shared.components.dateFilterComponent.dateTypes") type="created_at"}}</div>
        <div class="test-number-select">{{formatMessage (intlGet "patients.shared.listViews.countView.maximumListCount") maximumCount=50 totalInDb=1000 isFlowList=false}}</div>
        <div class="test-html">{{formatHTMLMessage "<strong>{ name }</strong>" name=name}}</div>
        <div class="test-html-safe">{{formatHTMLMessage "{ name }" name=(matchText "Patient Name" "Patient")}}</div>
        <div class="test-escaped">{{formatHTMLMessage "{ name }" name=name}}</div>
      `,
      templateContext() {
        return {
          testDate,
          formats: {
            date: {
              short: {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                timeZone: 'UTC',
              },
            },
          },
          functionMessage({ name }) {
            return `Function ${ name }`;
          },
          name: '<script>alert("bad")</script>',
        };
      },
    });

    cy
      .mount(() => {
        return new IntlView();
      })
      .as('root');

    cy
      .get('@root')
      .find('.test-date-format')
      .should('contain', '05/05/2026');

    cy
      .get('@root')
      .find('.test-date-options')
      .should('contain', 'May 5, 2026');

    cy
      .get('@root')
      .find('.test-intlname')
      .should('contain', '4 mins');

    cy
      .get('@root')
      .find('.test-function')
      .should('contain', 'Function Patient');

    cy
      .get('@root')
      .find('.test-message')
      .should('contain', '2 mins');

    cy
      .get('@root')
      .find('.test-select')
      .should('contain', 'Added');

    cy
      .get('@root')
      .find('.test-number-select')
      .should('contain', 'Showing 50 of 1,000 Actions.');

    cy
      .get('@root')
      .find('.test-html')
      .should('contain', '<script>alert("bad")</script>')
      .and('not.contain', '{ name }')
      .find('strong')
      .should('exist');

    cy
      .get('@root')
      .find('.test-html-safe')
      .find('strong')
      .should('contain', 'Patient');

    cy
      .get('@root')
      .find('.test-escaped script')
      .should('not.exist');
  });

  specify('Intl formatting defaults', function() {
    const localHandlebars = Handlebars.create();
    registerWith(localHandlebars);

    const template = localHandlebars.compile(`
      {{#intl locales="en-US"}}
        <div class="test-block">{{formatMessage "{ value }" value=false}}</div>
      {{/intl}}
      <div class="test-default-message">{{formatMessage "{ name }" name="Patient"}}</div>
      <div class="test-default-date">{{formatDate "2026-05-05T12:00:00Z" year="numeric" month="2-digit" day="2-digit" timeZone="UTC"}}</div>
      <div class="test-default-html">{{formatHTMLMessage "{ name }" name=safeName count=count}}</div>
    `);
    const html = template({
      count: 0,
      safeName: new localHandlebars.SafeString('<strong>Patient</strong>'),
    });

    expect(html).to.contain('<div class="test-block"></div>');
    expect(html).to.contain('<div class="test-default-message">Patient</div>');
    expect(html).to.contain('<div class="test-default-date">05/05/2026</div>');
    expect(html).to.contain('<div class="test-default-html"><strong>Patient</strong></div>');
  });

  specify('Intl formatting rejects invalid input', function() {
    const localHandlebars = Handlebars.create();
    registerWith(localHandlebars);

    const BadIntlTemplate = hbs`{{intl}}`;
    const BadLocalIntlGetTemplate = localHandlebars.compile('{{intlGet "not.found"}}');
    const BadIntlGetTemplate = hbs`{{intlGet "not.found"}}`;
    const BadDateTemplate = hbs`{{formatDate null}}`;
    const BadDateValueTemplate = hbs`{{formatDate "not-a-date"}}`;
    const BadMessageMissingTemplate = hbs`{{formatMessage}}`;
    const BadMessageTemplate = hbs`{{formatMessage message}}`;

    expect(() => {
      renderTemplate(BadIntlTemplate);
    }).to.throw('{{#intl}} must be invoked as a block helper');

    expect(() => {
      BadLocalIntlGetTemplate();
    }).to.throw('Could not find Intl object: not.found');

    expect(() => {
      renderTemplate(BadIntlGetTemplate);
    }).to.throw('Could not find Intl object: not.found');

    expect(() => {
      renderTemplate(BadDateTemplate);
    }).to.throw('A date or timestamp must be provided to {{formatDate}}');

    expect(() => {
      renderTemplate(BadDateValueTemplate);
    }).to.throw('A date or timestamp must be provided to {{formatDate}}');

    expect(() => {
      renderTemplate(BadMessageMissingTemplate);
    }).to.throw('{{formatMessage}} must be provided a message or intlName');

    expect(() => {
      renderTemplate(BadMessageTemplate, { message: { text: 'Bad Message' } });
    }).to.throw('{{formatMessage}} must be provided a message or intlName');
  });

  specify('Phone number formatting', function() {
    const PhoneView = View.extend({
      template: hbs`
        <div class="test-null">{{formatPhoneNumber null}}</div>
        <div class="test-phone">{{formatPhoneNumber phone}}</div>
        <div class="test-bad-phone">{{formatPhoneNumber badPhone}}</div>
        <div class="test-default-html">{{formatPhoneNumber null defaultHtml="No Phone Available"}}</div>
      `,
      templateContext() {
        return {
          phone: '6155555551',
          badPhone: 'UNKNOWN',
        };
      },
    });

    cy
      .mount(() => {
        return new PhoneView();
      })
      .as('root');

    cy
      .get('@root')
      .find('.test-null')
      .should('be.empty');

    cy
      .get('@root')
      .find('.test-phone')
      .should('contain', '(615) 555-5551');

    cy
      .get('@root')
      .find('.test-bad-phone')
      .should('be.empty');

    cy
      .get('@root')
      .find('.test-default-html')
      .should('contain', 'No Phone Available');
  });

  specify('isValue', function() {
    const IsValueView = View.extend({
      template: hbs`
        {{#if (isValue 'string' 'string')}}
          <div class="test-true-value">Should show</div>
        {{/if}}
        {{#if (isValue 'not-equal-string' 'string')}}
          <div class="test-false-value">Should not show</div>
        {{/if}}
        {{#if (isValue null 'string')}}
          <div class="test-null-value">Should not show</div>
        {{/if}}
      `,
    });

    cy
      .mount(() => {
        return new IsValueView();
      })
      .as('root');

    cy
      .get('@root')
      .find('.test-true-value')
      .should('exist');

    cy
      .get('@root')
      .find('.test-false-value')
      .should('not.exist');

    cy
      .get('@root')
      .find('.test-null-value')
      .should('not.exist');
  });
});
