import '@roundingwell/icons/styles.css';
import 'js/base/setup';
import 'js/i18n';
import 'scss/provider-core.scss';
import Backbone from 'backbone';
import { Radio, Region, CollectionView } from 'marionette';
import { _Model as Interaction } from 'js/entities-service/entities/interactions';
import InteractionItemView from 'js/apps/patients/shared/interactions/interaction-item_view';
import { RecentInteractionsView } from 'js/apps/patients/shared/widgets/recent-interactions_views';

Radio.reply('bootstrap', 'organization', new Backbone.Model({ name: 'Example Clinic' }));
const cases = [
  { id: 'campaign', channel: 'sms', direction: 'outbound', metadata: { disposition: '4th of July Text Blast' } },
  { id: 'reply', channel: 'sms', direction: 'inbound', metadata: { from: '+16155550101', disposition: 'Scheduling', body: 'Tuesday morning works for me.' } },
  { id: 'attempt', channel: 'sms', direction: 'outbound', metadata: { disposition: 'Text Sent', note: 'Sent the appointment reminder.' } },
  { id: 'empty', channel: 'sms', direction: 'outbound', metadata: {} },
  { id: 'call', channel: 'voicemail', direction: 'outbound', metadata: { disposition: 'Left VM', note: 'Requested a callback.' } },
];
window.cases = cases;
const collection = new Backbone.Collection(cases.map((row, index) => new Interaction({ ...row, occurred_at: `2026-07-04T14:0${ index }:00Z` })));
document.body.insertAdjacentHTML('beforeend', '<main><header><h1>Interactions</h1><p>Synthetic data • July 4, 2026</p></header><div class="preview-columns"><section><h2>Interaction cards</h2><div id="feed"></div></section><aside><h2>Recent Interactions</h2><div id="recent"></div></aside></div></main>');
const style = document.createElement('style');
style.textContent = 'body{background:var(--color-surface-secondary,#f7f8fa);padding:32px}main{max-width:1160px;margin:auto}h1{font-size:24px;margin:0 0 8px}header p{color:var(--color-text-secondary);margin:0 0 28px}h2{font-size:16px;font-weight:600;margin:0 0 18px}.preview-columns{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:40px}.preview-feed{list-style:none;padding:0;margin:0}aside{min-width:0}@media(max-width:700px){body{padding:20px}.preview-columns{grid-template-columns:1fr;gap:24px}}';
document.head.append(style);
const Feed = CollectionView.extend({ tagName: 'ol', className: 'preview-feed', childView: InteractionItemView });
new Region({ el: '#feed' }).show(new Feed({ collection }));
const recent = new RecentInteractionsView({ model: new Backbone.Model({ id: 'synthetic' }) });
new Region({ el: '#recent' }).show(recent);
recent.showInteractions(new Backbone.Collection(collection.models.slice(0,3).reverse()));
window.renderExtra = rows => {
  collection.reset(rows.map(row => new Interaction({ occurred_at: '2026-07-04T15:00:00Z', ...row })));
};
window.previewReady = true;
