import { parseAmountToCents } from './src/server/moneyUtils';
console.log(parseAmountToCents("20,00"));
console.log(parseAmountToCents("20.00"));
console.log(parseAmountToCents(20));
console.log(parseAmountToCents(0));
console.log(parseAmountToCents(null));
console.log(parseAmountToCents("invalid"));
