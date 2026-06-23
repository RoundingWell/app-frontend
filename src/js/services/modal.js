import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import App from 'js/base/app';

import intl from 'js/i18n';

import FormsService from 'js/services/forms';
import { addError } from 'js/datadog';

import { ModalView, SidebarModalView, SmallModalView, IframeFormView } from 'js/services/modal/modal_views';
import { DraftStatusView } from 'js/apps/patients/patient/form/form_views';

export default App.extend({
  channelName: 'modal',
  radioRequests: {
    'show': 'showModal',
    'show:small': 'showSmall',
    'show:custom': 'showCustom',
    'show:sidebar': 'showSidebar',
    'show:form': 'showForm',
  },
  initialize({ modalRegion, modalSmallRegion, modalSidebarRegion }) {
    this.modalRegion = modalRegion;
    this.modalSmallRegion = modalSmallRegion;
    this.modalSidebarRegion = modalSidebarRegion;
  },
  showModal(options) {
    const ConfirmModal = ModalView.extend(options);
    const view = new ConfirmModal();

    this.modalRegion.show(view);

    return view;
  },
  showSmall(options) {
    const ConfirmModal = SmallModalView.extend(options);
    const view = new ConfirmModal();

    this.modalSmallRegion.show(view);

    return view;
  },
  showCustom(view) {
    this.modalRegion.show(view);
    return view;
  },
  showSidebar(options) {
    const SidebarModal = SidebarModalView.extend(options);
    const view = new SidebarModal();

    this.modalSidebarRegion.show(view);

    return view;
  },
  showForm(patient, formName, form, size) {
    if (size === 'large') {
      this.routeLargeFormRequest(patient, form, formName);
      return;
    }

    const formService = new FormsService({ patient, form });
    const bodyView = new IframeFormView({ model: form, size });

    if (form.isReadOnly()) {
      this.showViewOnlyForm(formService, bodyView, formName);
      return;
    }

    const draftModel = new Backbone.Model();

    const modal = this.showModal({
      className: 'modal--large',
      headingText: formName,
      headerIcon: 'square-poll-horizontal',
      bodyView,
      onBeforeDestroy() {
        formService.destroy();
      },
      onSubmit() {
        modal.disableSubmit();
        Radio.request(`form${ form.id }`, 'send', 'form:submit');
      },
    });

    modal.disableSubmit();

    this.listenTo(draftModel, 'change:updated', (model, updated) => {
      if (!updated) {
        modal.getRegion('draftStatus').empty();
        return;
      }

      if (modal.getRegion('draftStatus').hasView()) return;

      const draftStatusView = new DraftStatusView({
        model: draftModel,
        viewOptions: {
          className: 'button--icon flex flex-align-center u-margin--r-16',
          template: hbs`{{far "shield-check"}}`,
        },
        position() {
          const bounds = this.getView().getBounds();
          return { ...bounds, outerHeight: bounds.outerHeight + 4 };
        },
      });

      modal.showChildView('draftStatus', draftStatusView);

      this.listenTo(draftStatusView, {
        async 'discard:submission'() {
          await Radio.request(`form${ form.id }`, 'clear:storedSubmission');

          modal.getChildView('body').render();
          modal.disableSubmit();
        },
      });
    });

    this.listenTo(formService, {
      'update:submission'(updated) {
        draftModel.set('updated', updated);
      },
      'success'() {
        modal.destroy();
      },
      'ready'() {
        modal.disableSubmit(false);
      },
      'error'() {
        modal.disableSubmit(false);
      },
    });

    Radio.request(`form${ form.id }`, 'get:storedSubmission').then(({ updated }) => {
      /* istanbul ignore if: difficult to force stale async render */
      if (modal.isDestroyed()) return;

      draftModel.set('updated', updated);
    });

    return modal;
  },
  routeLargeFormRequest(patient, form, formName) {
    Radio.trigger('event-router', 'patient:form', patient.id, form.id);

    addError(new Error('Large form modal request routed to patient form'), {
      patientId: patient.id,
      formId: form.id,
      formName,
    });
  },
  showViewOnlyForm(formService, bodyView, formName) {
    this.showModal({
      className: 'modal--large',
      headingText: formName,
      submitText: intl.globals.modal.modalViews.viewOnlyForm.doneText,
      cancelText: false,
      headerIcon: 'square-poll-horizontal',
      bodyView,
      onBeforeDestroy() {
        formService.destroy();
      },
    });
  },
});
