function formatPhone(phone) {
  if (!phone) return undefined;
  let p = phone.replace(/[^0-9+]/g, '');
  if (p.startsWith('00')) {
      p = '+' + p.substring(2);
  } else if (p.startsWith('0')) {
      p = '+386' + p.substring(1);
  } else if (!p.startsWith('+')) {
      p = '+386' + p;
  }
  return p;
}
console.log(formatPhone("031 123 123"));
console.log(formatPhone("00386 31 123 123"));
console.log(formatPhone("+386 31 123 123"));
console.log(formatPhone("31 123 123"));
