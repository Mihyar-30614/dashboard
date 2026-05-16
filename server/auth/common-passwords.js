export const COMMON_PASSWORDS = new Set([
  '123456','123456789','qwerty','password','12345','12345678','111111','1234567','sunshine','qwertyuiop',
  'iloveyou','princess','admin','welcome','666666','abc123','football','123123','monkey','654321',
  '!@#$%^&*','charlie','aa123456','donald','password1','qwerty123','zaq12wsx','login','starwars','passw0rd',
  '123qwe','dragon','master','hello','freedom','whatever','qazwsx','trustno1','jordan23','harley',
  'password123','baseball','solo','michelle','111222','jessica','letmein','superman','michael','batman',
  'pokemon','hottie','loveme','zaq1zaq1','password12','flower','lovely','7777777','555555','888888',
  '999999','aaaaaa','jennifer','hunter','buster','soccer','daniel','andrew','joshua','thomas',
  'jackson','robert','matthew','anthony','william','samantha','asdfgh','111111111','qwer1234','q1w2e3r4t5',
  'pa55w0rd','passw0rd1','admin123','test1234','changeme','dashboard','manager','welcome1','letmein123','iloveyou1',
  'football1','baseball1','sunshine1','princess1','michael1','dragon1','letmein1','qwerty1','password!','password!1',
  'password1234','password12345','qwerty12345','12345678910','letmein1234','admin1234','welcome1234','dashboard123'
]);

export function isCommonPassword(pw) {
  return COMMON_PASSWORDS.has(pw.toLowerCase());
}
