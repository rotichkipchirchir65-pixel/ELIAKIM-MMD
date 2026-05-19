let _store = null;
export const store = {
  set: (s) => { _store = s; },
  get: () => _store
};
