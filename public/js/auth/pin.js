// PIN setup and verification
const PinAuth = {
  async setPin(pin) {
    return API.setPin(pin);
  },

  async verifyPin(pin) {
    return API.verifyPin(pin);
  },

  hasPin() {
    return LocalDB.getMeta('hasPin');
  },
};
