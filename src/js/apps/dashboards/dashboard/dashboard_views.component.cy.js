import Backbone from 'backbone';

import { isSupersetDashboard } from './dashboard_views';

context('Dashboard views', function() {
  specify('detects Superset dashboards by provider', function() {
    expect(isSupersetDashboard(new Backbone.Model({ provider: 'superset' }))).to.equal(true);
    expect(isSupersetDashboard(new Backbone.Model({ provider: 'quicksight' }))).to.equal(false);
    expect(isSupersetDashboard(new Backbone.Model({}))).to.equal(false);
  });
});
