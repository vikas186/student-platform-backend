const key = 9876543210;
// Function to encrypt a number
const encryptNumber = (number, nKey = key) => {
  return number ^ nKey; // XOR the number with the key
};

const decryptNumber = (encryptedNumber, nKey = key) => {
  return encryptedNumber ^ nKey; // XOR the encrypted number with the key
};

const id = encryptNumber(117);
console.log(id);
