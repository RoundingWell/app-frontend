import StateModel from './nav_state';

context('Nav State', function() {
  specify('keeps derived layout state when an input is unset', function() {
    const state = new StateModel({ isNarrow: true });

    state.unset('isNarrow');

    expect(state.get('isMinimized')).to.be.false;
    expect(state.get('isFullNavVisible')).to.be.true;
  });

  specify('preserves an empty model when cleared', function() {
    const state = new StateModel();

    state.clear();

    expect(state.attributes).to.deep.equal({});
  });
});
