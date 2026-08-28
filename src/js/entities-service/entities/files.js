import { get, first } from 'underscore';
import Store from 'backbone.store';
import Radio from 'backbone.radio';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'files';
const WRITABLE_ATTRIBUTES = [
  'path',
];

// Adds `-copy` to the filename before the extension
function dedupeFile(fileName) {
  const extIndex = fileName.lastIndexOf('.');
  return `${ fileName.slice(0, extIndex) }-copy${ fileName.slice(extIndex) }`;
}

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  defaults: {
    path: '',
    _progress: 0,
  },
  type: TYPE,
  messages: {
    FileReplaced({ attributes }) {
      this.set({
        path: attributes.path,
        _view: attributes.urls.view,
        _download: attributes.urls.download,
      });
    },
    FileRemoved() {
      const actions = this.getActions();

      actions.invoke('removeFile', this);

      this.destroy({ isDeleted: true });
    },
  },
  urlRoot() {
    if (this.isNew()) {
      const action = this.getActions().at(0);

      return `/api/actions/${ action.id }/relationships/files?urls=upload`;
    }
    return '/api/files';
  },
  getActions() {
    return Radio.request('entities', 'actions:collection', this.get('_actions'));
  },
  getPatient() {
    return this.getRelationship('_patient');
  },
  fetchFile() {
    return this.fetch({
      url: `${ this.url() }?urls=download,view`,
    });
  },
  createUpload(fileName) {
    const patient = this.getPatient();
    const path = `patient/${ patient.id }/${ fileName }`;
    const promise = this.save({ path, _progress: 0 }, {}, { type: 'PUT' });

    return promise.catch((/* istanbul ignore next */{ responseData } = {}) => {
      const error = get(first(responseData.errors), 'detail', '');

      /* istanbul ignore else */
      if (error.includes('Another file exists')) {
        return this.createUpload(dedupeFile(fileName));
      }

      /* istanbul ignore next */
      throw responseData;
    });
  },
  upload(file) {
    this.createUpload(file.name)
      .then(() => this.putFile(file))
      .then(() => this.fetchFile())
      .then(uploadedFile => {
        this.trigger('upload:success', uploadedFile);
      })
      .catch(() => {
        this.trigger('upload:failed');
        this.destroy();
      });
  },
  putFile(file) {
    const fileSize = file.size;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        if (xhr.status !== 200) {
          reject();

          return;
        }
        this.set({ _progress: 100 });
        resolve();
      };

      xhr.upload.onprogress = e => {
        /* istanbul ignore if */
        if (!e.lengthComputable) return;
        this.set({ _progress: Math.round((e.loaded / fileSize) * 100) });
      };

      xhr.open('PUT', this.get('_upload'));
      xhr.send(file);
    });
  },
  getFilename() {
    return this.get('path').split('/').pop();
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  model: Model,
});

export {
  _Model,
  Model,
  Collection,
};
