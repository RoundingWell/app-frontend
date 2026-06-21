import Radio from 'backbone.radio';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import CheckComponent from './components/check_component';
import StateComponent from './components/state_component';
import OwnerComponent from './components/owner_component';

const i18n = intl.patients.shared.flowsViews;

const FlowStateComponent = StateComponent.extend({
  onPicklistSelect({ model }) {
    // Selected done
    if (model.isDone() && this.getOption('flow')) {
      this.shouldSelectDone(model);
      return;
    }

    this.setSelectedStatus(model);
  },
  shouldSelectDone(model) {
    const flow = this.getOption('flow');

    if (flow.isAllDone()) {
      this.setSelectedStatus(model);
      return;
    }

    // We must hide the droplist before showing the modal
    this.popRegion.empty();

    if (Radio.request('settings', 'get', 'require_done_flow')) {
      Radio.request('modal', 'show:small', {
        bodyText: i18n.requireDoneModal.bodyText,
        headingText: i18n.requireDoneModal.headingText,
        submitText: i18n.requireDoneModal.submitText,
        cancelText: false,
        buttonClass: 'button--blue',
      });
      return;
    }

    const modal = Radio.request('modal', 'show:small', {
      bodyText: i18n.doneModal.bodyText,
      headingText: i18n.doneModal.headingText,
      submitText: i18n.doneModal.submitText,
      onSubmit: () => {
        this.setSelectedStatus(model);
        modal.destroy();
      },
    });
  },
  setSelectedStatus(model) {
    this.setState('selected', model);
    this.popRegion.empty();
  },
});

export {
  CheckComponent,
  FlowStateComponent,
  OwnerComponent,
};
