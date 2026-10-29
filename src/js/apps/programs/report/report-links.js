import Backbone from 'backbone';
import { Radio } from 'marionette';

export function reportUrl(path) {
  const workspace = Radio.request('workspace', 'current');
  return `/${ workspace.get('slug') }/${ path }`;
}

export function navigateReportLink(event) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  const path = event.delegateTarget.getAttribute('href');
  if (window.location.pathname === path) return;

  Backbone.history.navigate(path.slice(1), { trigger: true });
}
