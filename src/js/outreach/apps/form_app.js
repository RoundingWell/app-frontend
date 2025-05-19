import { map } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import { postResponse } from 'js/outreach/entities';

import {
  iFrameFormView,
  SaveView,
} from 'js/outreach/views/form_views';

import { DialogView } from 'js/outreach/views/dialog_views';
import { ErrorView } from 'js/outreach/views/error_views';

export default App.extend({
  beforeStart({ actionId }) {
    return [
      Radio.request('entities', 'fetch:forms:byAction', actionId),
      Radio.request('entities', 'fetch:forms:data', actionId),
    ];
  },
  /* istanbul ignore next: Don't handle non-API errors */
  onFail() {
    const dialogView = new DialogView();
    dialogView.showChildView('content', new ErrorView());
    this.showView(dialogView);
  },
  onStart({ actionId }, form, data) {
    this.actionId = actionId;
    this.form = form;
    this.formData = data.attributes;
    this.setView(new iFrameFormView({ model: this.form }));
    this.startService();
    this.showFormSaveDisabled();
    this.showView();
  },
  startService() {
    this.channel = Radio.channel(`form${ this.form.id }`);

    this.channel.reply({
      'ready:form': this.showFormSave,
      'submit:form': this.submitForm,
      'fetch:form:data': this.getFormPrefill,
      'fetch:form:definition': this.getFormDefinition,
    }, this);
  },
  getFormDefinition() {
    const fetchFormDefinition = Radio.request('entities', 'fetch:forms:definition', this.form.id);

    fetchFormDefinition.then(definition => {
      this.channel.request('send', 'fetch:form:definition', definition);
    });
  },
  getFormPrefill() {
    this.channel.request('send', 'fetch:form:data', {
      formData: this.formData,
      formSubmission: {},
      options: this.form.get('options'),
    });
  },
  showFormSaveDisabled() {
    if (this.form.isReadOnly()) return;
    this.showChildView('formAction', new SaveView({ isDisabled: true }));
  },
  showFormSave() {
    if (this.form.isReadOnly()) return;
    const saveView = this.showChildView('formAction', new SaveView());

    this.listenTo(saveView, 'click', () => {
      this.channel.request('send', 'form:submit');
    });
  },
  submitForm({ response }) {
    postResponse({
      formId: this.form.id,
      actionId: this.actionId,
      response,
    })
      .then(/* istanbul ignore next: Skipping flaky portion of Outreach > Form test */
        () => {
          this.showView(new DialogView());
        })
      .catch(({ responseData }) => {
        this.showFormSave();
        /* istanbul ignore next: Don't handle non-API errors */
        if (!responseData) return;
        const errors = map(responseData.errors, 'detail');
        this.channel.request('send', 'form:errors', errors);
      });
  },
});
