import Radio from 'backbone.radio';
import App from 'js/base/app';

import intl from 'js/i18n';

import FormsService from 'js/services/forms';

import { ModalView, SidebarModalView, SmallModalView, IframeFormView } from 'js/views/globals/modal/modal_views';

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
    const formService = new FormsService({ patient, form });
    const bodyView = new IframeFormView({ model: form, size });

    if (form.isReadOnly() || form.isReport()) {
      this.showViewOnlyForm(formService, bodyView, formName);
      return;
    }

    const modal = this.showModal({
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

    this.listenTo(formService, {
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

    return modal;
  },
  showViewOnlyForm(formService, bodyView, formName) {
    this.showModal({
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
