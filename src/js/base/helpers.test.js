import { describe, it, expect } from 'vitest';
import Handlebars from 'handlebars/dist/cjs/handlebars';

import 'js/base/helpers';

import { testTs } from 'helpers/test-timestamp';
import formatDate from 'helpers/format-date';

function render(template, context = {}) {
  return Handlebars.compile(template)(context);
}

describe('Handlebars helpers', () => {
  it('formats matched text', () => {
    const html = render(`
      <div class="test-null">{{matchText "Patient Name" null}}</div>
      <div class="test-match">{{matchText "Patient Name" "Patient"}}</div>
      <div class="test-match-substring">{{matchText "TestPatient Name" "patient" includeSubstrings=true}}</div>
      <div class="test-noescape">{{matchText "<span style='color: green'>Patient</span> Name" "Patient" noEscape=true}}</div>
    `);

    const container = document.createElement('div');
    container.innerHTML = html;

    expect(container.querySelector('.test-null strong')).toBeNull();
    expect(container.querySelector('.test-match strong')?.textContent).toBe('Patient');
    expect(container.querySelector('.test-match-substring strong')?.textContent).toBe('Patient');
    expect(container.querySelector('.test-noescape strong')?.parentElement?.style.color).toBe('green');
  });

  it('formats dates', () => {
    const date = testTs();
    const html = render(`
      <div class="test-null">{{formatDateTime null "lll"}}</div>
      <div class="test-date">{{formatDateTime testDate "lll"}}</div>
      <div class="test-nowrap">{{formatDateTime testDate "lll" nowrap=false}}</div>
      <div class="test-default-html">{{formatDateTime null "lll" defaultHtml="No Date Available"}}</div>
    `, { testDate: date });

    const container = document.createElement('div');
    container.innerHTML = html;

    expect(container.querySelector('.test-null')?.innerHTML).toBe('');
    expect(container.querySelector('.test-date')?.textContent).toContain(formatDate(date, 'lll'));
    expect(container.querySelector('.test-nowrap .u-text--nowrap')).toBeNull();
    expect(container.querySelector('.test-default-html')?.textContent).toContain('No Date Available');
  });

  it('formats phone numbers', () => {
    const html = render(`
      <div class="test-null">{{formatPhoneNumber null}}</div>
      <div class="test-phone">{{formatPhoneNumber phone}}</div>
      <div class="test-bad-phone">{{formatPhoneNumber badPhone}}</div>
      <div class="test-default-html">{{formatPhoneNumber null defaultHtml="No Phone Available"}}</div>
    `, {
      phone: '6155555551',
      badPhone: 'UNKNOWN',
    });

    const container = document.createElement('div');
    container.innerHTML = html;

    expect(container.querySelector('.test-null')?.innerHTML).toBe('');
    expect(container.querySelector('.test-phone')?.textContent).toContain('(615) 555-5551');
    expect(container.querySelector('.test-bad-phone')?.innerHTML).toBe('');
    expect(container.querySelector('.test-default-html')?.textContent).toContain('No Phone Available');
  });

  it('checks equality with isValue', () => {
    const html = render(`
      {{#if (isValue 'string' 'string')}}
        <div class="test-true-value">Should show</div>
      {{/if}}
      {{#if (isValue 'not-equal-string' 'string')}}
        <div class="test-false-value">Should not show</div>
      {{/if}}
      {{#if (isValue null 'string')}}
        <div class="test-null-value">Should not show</div>
      {{/if}}
    `);

    const container = document.createElement('div');
    container.innerHTML = html;

    expect(container.querySelector('.test-true-value')).not.toBeNull();
    expect(container.querySelector('.test-false-value')).toBeNull();
    expect(container.querySelector('.test-null-value')).toBeNull();
  });
});
