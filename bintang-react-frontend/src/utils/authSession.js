const AUTH_KEYS = ['access_token', 'refresh_token', 'user_data'];

const removeLegacyAuth = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};

const authSession = {
  getAccessToken: () => sessionStorage.getItem('access_token'),
  getRefreshToken: () => sessionStorage.getItem('refresh_token'),
  getUser: () => sessionStorage.getItem('user_data'),

  start(user, accessToken, refreshToken) {
    // Sesi akun harus milik tab ini saja. localStorage dibagi semua tab dan
    // sebelumnya menyebabkan request staf lain menggunakan token akun terakhir.
    removeLegacyAuth();
    sessionStorage.setItem('access_token', accessToken);
    sessionStorage.setItem('refresh_token', refreshToken);
    sessionStorage.setItem('user_data', JSON.stringify(user));
  },

  setAccessToken(accessToken) {
    sessionStorage.setItem('access_token', accessToken);
  },

  setUser(user) {
    sessionStorage.setItem('user_data', JSON.stringify(user));
  },

  clear() {
    AUTH_KEYS.forEach((key) => sessionStorage.removeItem(key));
    removeLegacyAuth();
  },
};

export default authSession;
