import { View } from 'marionette';

import ConsentAuditTemplate from './consent-audit.hbs';

import './consent-audit.scss';

// The host returns text segments and immutable audit snapshots. This presenter
// never looks up the current phone list or writes consent state.
const ConsentAuditView = View.extend({
  tagName: 'li',
  className: 'messaging-consent-audit',
  template: ConsentAuditTemplate,
  modelEvents: { change: 'render' },
  templateContext() {
    return { audit: this.getOption('presentAudit')(this.getOption('interaction') || this.model) };
  },
});

export default ConsentAuditView;
